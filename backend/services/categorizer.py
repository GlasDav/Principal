import re
from typing import Dict, Tuple, Optional

class Categorizer:
    def __init__(self):
        pass

    def apply_rules(self, description: str, rules, amount: float = None) -> Optional[int]:
        """
        Applies priority-based regex rules.
        rules: List of CategorizationRule objects (ordered by priority desc)
        amount: Optional transaction amount to check against min_amount/max_amount conditions
        Returns: bucket_id (int) or None
        """
        description_lower = description.lower()
        
        for rule in rules:
            # Check amount conditions if rule has them set
            if amount is not None:
                if rule.min_amount is not None and abs(amount) < rule.min_amount:
                    continue  # Amount too low, skip this rule
                if rule.max_amount is not None and abs(amount) > rule.max_amount:
                    continue  # Amount too high, skip this rule
            
            keywords = rule.keywords.lower().split(",")
            for k in keywords:
                k = k.strip()
                if not k: continue
                # Exact match or word boundary match?
                # User might input "Woolworths" and expects "Woolworths Metro" to match.
                # Simple substring check is often expected, but risky ("car" matches "care").
                # Let's use word boundary if possible, or substring if length > 3?
                # For now, substring check is easiest for users to understand, but regex is more powerful.
                # Hybrid: if k contains regex chars, use regex. Else substring.
                
                try:
                    if k in description_lower:
                        return rule
                except:
                    continue
                    
        return None

    def predict(self, description: str, rules_map: Dict[str, str] = {}) -> Tuple[Optional[str], float]:
        """
        Returns (predicted_category_name, confidence_score)
        Confidence is 1.0 for keyword match, 0.0 otherwise.
        
        rules_map: Dict of {keyword: category_name}
        """
        description_lower = description.lower()
        
        for keyword, category in rules_map.items():
            # word boundary regex to avoid partial matches like "parent" matching "rent"
            if re.search(r'\b' + re.escape(keyword), description_lower) or keyword in description_lower:
                return category, 1.0
                
        return None, 0.0

    # Static Knowledge Base for "Best Guess"
    GLOBAL_KEYWORDS = {
        "groceries": ["woolworths", "coles", "aldi", "iga", "countdown", "supermarket", "mart", "bakery", "bi-lo", "harris farm", "costco"],
        "eating out": ["mcdonalds", "kfc", "hungry jacks", "domino", "pizza", "subway", "starbucks", "cafe", "coffee", "restaurant", "burger", "grill", "sushi", "nandos", "ubereats", "doordash", "menulog"],
        "transport": ["shell", "bp", "caltex", "ampol", "7-eleven", "united", "metro", "fuel", "petrol", "uber", "didiglobal", "taxi", "cab", "transport", "opal", "myki", "go card"],
        "utilities": ["agl", "origin", "energy", "water", "electricity", "gas", "telstra", "optus", "vodafone", "internet", "broadband"],
        "entertainment": ["netflix", "spotify", "youtube", "disney", "prime", "cinema", "movie", "event cinemas", "hoyts", "steam", "playstation", "xbox"],
        "health": ["chemist", "pharmacy", "priceline", "doctor", "medical", "dental", "hospital", "gym", "fitness", "anytime", "fitness first"],
        "insurance": ["allianz", "nrma", "aami", "racv", "racq", "bupa", "medibank", "nib", "insurance"],
        "shopping": ["kmart", "big w", "target", "myer", "david jones", "amazon", "ebay", "bunnings", "ikea", "officeworks", "jbhifi", "reject shop"],
        "housing": ["rent", "mortgage", "loan", "real estate", "strata", "body corp"],
        "transfers": ["transfer", "internal transfer", "credit card payment", "payment to", "payment from", "to acc", "from acc"]
    }

    def guess_category(self, description: str, bucket_map: Dict[str, int]) -> Tuple[Optional[int], float]:
        """
        Attempts to guess the bucket based on common global keywords.
        bucket_map: {bucket_name_lowercase: bucket_id}
        Returns: (bucket_id, confidence)
        """
        desc_lower = description.lower()
        
        for category, keywords in self.GLOBAL_KEYWORDS.items():
            # Check if any keyword matches the description
            for keyword in keywords:
                if keyword in desc_lower:
                    # Match found! Now check if user has a relevant bucket.
                    
                    # 1. Direct Name Match (e.g. user has "Groceries" bucket)
                    if category in bucket_map:
                        return bucket_map[category], 0.7 # High confidence guess
                        
                    # 2. Semantic/Fuzzy Match?
                    # If we found "Woolworths" -> "Groceries", but user has "Food" bucket?
                    # Mapping known aliases:
                    aliases = {
                        "groceries": ["food", "supermarket", "household"],
                        "eating out": ["dining", "takeaway", "restaurants", "food", "entertainment"], # Food is ambiguous
                        "transport": ["fuel", "car", "gas", "commute", "travel"],
                        "utilities": ["bills", "services", "phone", "internet"],
                        "health": ["medical", "wellness"],
                        "shopping": ["personal", "hobbies"],
                        "transfers": ["transfer", "credit card", "payments"],
                    }
                    
                    if category in aliases:
                        for alias in aliases[category]:
                            if alias in bucket_map:
                                return bucket_map[alias], 0.6 # Moderate confidence
                                
                    # 3. Fallback: Search all user buckets for the keyword 
                    # (e.g. desc has "Uber", user has "Uber" bucket)
                    # This might overlap with legacy predict but is broader
                    for b_name, b_id in bucket_map.items():
                        if keyword == b_name or b_name in keyword:
                             return b_id, 0.8
                             
        return None, 0.0

    def clean_description(self, description: str) -> str:
        """
        Cleans up raw transaction descriptions to be more readable.
        Removes: dates, times, 'CARD PURCHASE', 'POS REF', generic locations.
        """
        text = description.upper()
        
        # 1. Remove common prefixes/suffixes
        remove_patterns = [
            r"CARD PURCHASE",
            r"POS PURCHASE",
            r"VISA PURCHASE",
            r"DEBIT PURCHASE",
            r"EFTPOS",
            r"Osko Payment",
            r"Direct Debit",
            r"Value Date:?",
            r"\d{2} [A-Z]{3}", # Date like 15 NOV
        ]
        
        for pattern in remove_patterns:
            text = re.sub(pattern, "", text, flags=re.IGNORECASE)
            
        # 2. Remove purely numeric sequences or long ID strings
        text = re.sub(r"\b\d{6,}\b", "", text) # Long numbers
        
        # 3. Clean up whitespace
        text = re.sub(r"\s+", " ", text).strip()
        
        # 4. Title case for better readability if it was all caps
        if text.isupper():
            text = text.title()
            
        return text if text else description # Return original if we stripped everything
