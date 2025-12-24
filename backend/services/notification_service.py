from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from .. import models
import json

class NotificationService:
    @staticmethod
    def create_notification(db: Session, user_id: int, type: str, message: str, meta_data: str = None):
        """
        Create a new notification for a user.
        """
        notification = models.Notification(
            user_id=user_id,
            type=type,
            message=message,
            meta_data=meta_data
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return notification
    
    @staticmethod
    def get_settings(db: Session, user_id: int):
        """Get notification settings for a user, with defaults if not set."""
        settings = db.query(models.NotificationSettings).filter(
            models.NotificationSettings.user_id == user_id
        ).first()
        
        if not settings:
            # Return default settings object (not persisted)
            return type('DefaultSettings', (), {
                'budget_alerts': True,
                'bill_reminders': True,
                'goal_milestones': True,
                'bill_reminder_days': 3
            })()
        return settings
    
    @staticmethod
    def check_budget_exceeded(db: Session, user_id: int, bucket_id: int):
        """
        Check if spending in a bucket has exceeded budget thresholds.
        Creates notifications at 80%, 100%, and 120% thresholds.
        Uses deduplication to avoid repeat alerts in the same month.
        """
        # Check settings
        settings = NotificationService.get_settings(db, user_id)
        if not settings.budget_alerts:
            return None
        
        # Get the bucket
        bucket = db.query(models.BudgetBucket).filter(
            models.BudgetBucket.id == bucket_id,
            models.BudgetBucket.user_id == user_id
        ).first()
        
        if not bucket:
            return None
        
        # Calculate total limit for the bucket (sum of all member limits)
        total_limit = db.query(func.sum(models.BudgetLimit.amount)).filter(
            models.BudgetLimit.bucket_id == bucket_id
        ).scalar() or 0
        
        if total_limit <= 0:
            return None  # No budget set
        
        # Get current month's spending
        now = datetime.utcnow()
        month_start = datetime(now.year, now.month, 1)
        
        total_spent = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.bucket_id == bucket_id,
            models.Transaction.date >= month_start,
            models.Transaction.amount < 0  # Expenses are negative
        ).scalar() or 0
        
        total_spent = abs(total_spent)  # Convert to positive for comparison
        
        # Calculate percentage
        if total_limit <= 0:
            return None
        
        percent = (total_spent / total_limit) * 100
        
        # Determine threshold level
        threshold = None
        if percent >= 120:
            threshold = 120
            message = f"❌ {bucket.name} is significantly over budget ({int(percent)}%)"
        elif percent >= 100:
            threshold = 100
            message = f"🚨 {bucket.name} has exceeded budget!"
        elif percent >= 80:
            threshold = 80
            message = f"⚠️ {bucket.name} is at {int(percent)}% of budget"
        else:
            return None  # Below all thresholds
        
        # Check for existing notification at this threshold this month
        month_key = f"{now.year}-{now.month:02d}"
        existing = db.query(models.Notification).filter(
            models.Notification.user_id == user_id,
            models.Notification.type == "budget",
            models.Notification.meta_data.contains(f'"bucket_id": {bucket_id}'),
            models.Notification.meta_data.contains(f'"threshold": {threshold}'),
            models.Notification.meta_data.contains(f'"month": "{month_key}"')
        ).first()
        
        if existing:
            return None  # Already notified for this threshold this month
        
        # Create notification with metadata for deduplication
        meta = json.dumps({
            "bucket_id": bucket_id,
            "bucket_name": bucket.name,
            "threshold": threshold,
            "month": month_key,
            "percent": round(percent, 1),
            "spent": total_spent,
            "limit": total_limit
        })
        
        return NotificationService.create_notification(
            db, user_id, "budget", message, meta
        )

    @staticmethod
    def get_upcoming_bills(db: Session, user_id: int, days_ahead: int = 7):
        """
        Get active subscriptions due within the next X days.
        """
        from datetime import timedelta
        
        today = datetime.utcnow().date()
        end_date = today + timedelta(days=days_ahead)
        
        upcoming = db.query(models.Subscription).filter(
            models.Subscription.user_id == user_id,
            models.Subscription.is_active == True,
            models.Subscription.next_due_date >= today,
            models.Subscription.next_due_date <= end_date
        ).order_by(models.Subscription.next_due_date).all()
        
        return upcoming
    
    @staticmethod
    def check_upcoming_bills(db: Session, user_id: int, days_ahead: int = 3):
        """
        Create notifications for bills due within X days if not already notified.
        """
        # Check settings
        settings = NotificationService.get_settings(db, user_id)
        if not settings.bill_reminders:
            return []
        
        # Use user's preferred reminder days if lower than requested
        effective_days = min(days_ahead, settings.bill_reminder_days)
        
        from datetime import timedelta
        
        today = datetime.utcnow().date()
        end_date = today + timedelta(days=effective_days)
        
        upcoming = db.query(models.Subscription).filter(
            models.Subscription.user_id == user_id,
            models.Subscription.is_active == True,
            models.Subscription.next_due_date >= today,
            models.Subscription.next_due_date <= end_date
        ).all()
        
        notifications_created = []
        for sub in upcoming:
            # Check for existing notification for this subscription this month
            month_key = f"{today.year}-{today.month:02d}"
            existing = db.query(models.Notification).filter(
                models.Notification.user_id == user_id,
                models.Notification.type == "bill",
                models.Notification.meta_data.contains(f'"subscription_id": {sub.id}'),
                models.Notification.meta_data.contains(f'"month": "{month_key}"')
            ).first()
            
            if existing:
                continue
            
            # Calculate days until due
            days_until = (sub.next_due_date - today).days
            if days_until == 0:
                message = f"📅 {sub.name} is due today (${abs(sub.amount):.2f})"
            elif days_until == 1:
                message = f"📅 {sub.name} is due tomorrow (${abs(sub.amount):.2f})"
            else:
                message = f"📅 {sub.name} is due in {days_until} days (${abs(sub.amount):.2f})"
            
            meta = json.dumps({
                "subscription_id": sub.id,
                "subscription_name": sub.name,
                "amount": sub.amount,
                "due_date": sub.next_due_date.isoformat(),
                "month": month_key
            })
            
            notification = NotificationService.create_notification(
                db, user_id, "bill", message, meta
            )
            notifications_created.append(notification)
        
        return notifications_created
    
    @staticmethod
    def advance_subscription_date(db: Session, subscription_id: int):
        """
        Advance a subscription's next_due_date based on its frequency.
        Called when a matching transaction is confirmed.
        """
        from datetime import timedelta
        from dateutil.relativedelta import relativedelta
        
        sub = db.query(models.Subscription).filter(
            models.Subscription.id == subscription_id
        ).first()
        
        if not sub:
            return None
        
        freq = sub.frequency.lower() if sub.frequency else "monthly"
        
        if freq == "weekly":
            sub.next_due_date = sub.next_due_date + timedelta(weeks=1)
        elif freq == "fortnightly" or freq == "biweekly":
            sub.next_due_date = sub.next_due_date + timedelta(weeks=2)
        elif freq == "monthly":
            sub.next_due_date = sub.next_due_date + relativedelta(months=1)
        elif freq == "quarterly":
            sub.next_due_date = sub.next_due_date + relativedelta(months=3)
        elif freq == "yearly" or freq == "annual":
            sub.next_due_date = sub.next_due_date + relativedelta(years=1)
        else:
            # Default to monthly
            sub.next_due_date = sub.next_due_date + relativedelta(months=1)
        
        db.commit()
        return sub
    
    @staticmethod
    def check_goal_milestone(db: Session, user_id: int, goal_id: int):
        """
        Check if a goal has reached a milestone (25%, 50%, 75%, 100%).
        Creates celebratory notifications at each milestone.
        """
        # Check settings
        settings = NotificationService.get_settings(db, user_id)
        if not settings.goal_milestones:
            return None
        
        goal = db.query(models.Goal).filter(
            models.Goal.id == goal_id,
            models.Goal.user_id == user_id
        ).first()
        
        if not goal or not goal.target_amount or goal.target_amount <= 0:
            return None
        
        # Calculate current amount
        current_amount = 0.0
        if goal.linked_account_id:
            # Get latest balance from AccountBalance
            from sqlalchemy import desc
            latest_snapshot = db.query(models.NetWorthSnapshot).filter(
                models.NetWorthSnapshot.user_id == user_id
            ).order_by(desc(models.NetWorthSnapshot.date)).first()
            
            if latest_snapshot:
                balance_entry = db.query(models.AccountBalance).filter(
                    models.AccountBalance.snapshot_id == latest_snapshot.id,
                    models.AccountBalance.account_id == goal.linked_account_id
                ).first()
                if balance_entry:
                    current_amount = balance_entry.balance
        else:
            # Sum of transactions linked to this goal
            total = db.query(func.sum(models.Transaction.amount)).filter(
                models.Transaction.goal_id == goal_id,
                models.Transaction.user_id == user_id
            ).scalar()
            current_amount = total if total else 0.0
        
        # Calculate percentage
        percent = (current_amount / goal.target_amount) * 100
        
        # Determine milestone
        milestone = None
        if percent >= 100:
            milestone = 100
            message = f"🏆 Congratulations! {goal.name} is fully funded!"
        elif percent >= 75:
            milestone = 75
            message = f"🚀 Almost there! {goal.name} is 75% complete"
        elif percent >= 50:
            milestone = 50
            message = f"🎉 Halfway there! {goal.name} is 50% funded"
        elif percent >= 25:
            milestone = 25
            message = f"🎯 {goal.name} is 25% complete!"
        else:
            return None  # Below all milestones
        
        # Check for existing notification at this milestone for this goal
        existing = db.query(models.Notification).filter(
            models.Notification.user_id == user_id,
            models.Notification.type == "goal",
            models.Notification.meta_data.contains(f'"goal_id": {goal_id}'),
            models.Notification.meta_data.contains(f'"milestone": {milestone}')
        ).first()
        
        if existing:
            return None  # Already notified for this milestone
        
        # Create notification
        meta = json.dumps({
            "goal_id": goal_id,
            "goal_name": goal.name,
            "milestone": milestone,
            "current_amount": current_amount,
            "target_amount": goal.target_amount,
            "percent": round(percent, 1)
        })
        
        return NotificationService.create_notification(
            db, user_id, "goal", message, meta
        )
    
    @staticmethod
    def check_all_goal_milestones(db: Session, user_id: int):
        """
        Check milestones for all active goals for a user.
        Called after net worth snapshot is taken.
        """
        goals = db.query(models.Goal).filter(
            models.Goal.user_id == user_id
        ).all()
        
        notifications_created = []
        for goal in goals:
            notification = NotificationService.check_goal_milestone(db, user_id, goal.id)
            if notification:
                notifications_created.append(notification)
        
        return notifications_created

