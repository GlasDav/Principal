"""
Principal Finance - Authentication Tests

Tests for:
- User registration
- Login/logout
- Password reset flow
- Email verification
- Token refresh
"""
import pytest


class TestRegistration:
    """Tests for user registration endpoint."""
    
    def test_register_success(self, client):
        """Successful registration with valid credentials."""
        response = client.post("/auth/register", json={
            "email": "newuser@example.com",
            "password": "SecurePassword123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "newuser@example.com"
    
    def test_register_weak_password(self, client):
        """Registration fails with weak password."""
        response = client.post("/auth/register", json={
            "email": "weak@example.com",
            "password": "123"  # Too short
        })
        assert response.status_code == 422  # Validation error
    
    def test_register_invalid_email(self, client):
        """Registration fails with invalid email format."""
        response = client.post("/auth/register", json={
            "email": "not-an-email",
            "password": "SecurePassword123!"
        })
        assert response.status_code == 422
    
    def test_register_duplicate_email(self, client, test_user):
        """Registration fails with existing email."""
        response = client.post("/auth/register", json={
            "email": test_user.email,
            "password": "AnotherPassword123!"
        })
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()


class TestLogin:
    """Tests for login endpoint."""
    
    def test_login_success(self, client, test_user, test_user_data):
        """Successful login with valid credentials."""
        response = client.post("/auth/token", data={
            "username": test_user_data["email"],
            "password": test_user_data["password"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
    
    def test_login_wrong_password(self, client, test_user, test_user_data):
        """Login fails with wrong password."""
        response = client.post("/auth/token", data={
            "username": test_user_data["email"],
            "password": "WrongPassword123!"
        })
        assert response.status_code == 401
    
    def test_login_nonexistent_user(self, client):
        """Login fails for non-existent user."""
        response = client.post("/auth/token", data={
            "username": "nobody@example.com",
            "password": "SomePassword123!"
        })
        assert response.status_code == 401


class TestTokenRefresh:
    """Tests for token refresh endpoint."""
    
    def test_refresh_token_success(self, client, test_user, test_user_data):
        """Refresh token returns new access token."""
        # First, login to get tokens
        login_response = client.post("/auth/token", data={
            "username": test_user_data["email"],
            "password": test_user_data["password"]
        })
        refresh_token = login_response.json()["refresh_token"]
        
        # Then refresh
        response = client.post("/auth/refresh", json={
            "refresh_token": refresh_token
        })
        assert response.status_code == 200
        assert "access_token" in response.json()
    
    def test_refresh_invalid_token(self, client):
        """Refresh fails with invalid token."""
        response = client.post("/auth/refresh", json={
            "refresh_token": "invalid-token-here"
        })
        assert response.status_code == 401


class TestCurrentUser:
    """Tests for current user endpoint."""
    
    def test_get_current_user(self, client, auth_headers, test_user):
        """Get current user profile."""
        response = client.get("/auth/users/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
    
    def test_get_current_user_no_auth(self, client):
        """Unauthorized without token."""
        response = client.get("/auth/users/me")
        assert response.status_code == 401


class TestPasswordReset:
    """Tests for password reset flow."""
    
    def test_forgot_password_existing_user(self, client, test_user):
        """Forgot password request succeeds for existing user."""
        response = client.post("/auth/forgot-password", json={
            "email": test_user.email
        })
        # Always returns success to prevent email enumeration
        assert response.status_code == 200
    
    def test_forgot_password_nonexistent_user(self, client):
        """Forgot password also succeeds for non-existent user (security)."""
        response = client.post("/auth/forgot-password", json={
            "email": "doesnotexist@example.com"
        })
        # Should still return success to prevent enumeration
        assert response.status_code == 200
    
    def test_reset_password_invalid_token(self, client):
        """Reset password fails with invalid token."""
        response = client.post("/auth/reset-password", json={
            "token": "invalid-reset-token",
            "new_password": "NewSecurePassword123!"
        })
        assert response.status_code == 400


class TestEmailVerification:
    """Tests for email verification flow."""
    
    def test_verify_email_invalid_token(self, client):
        """Email verification fails with invalid token."""
        response = client.post("/auth/verify-email", json={
            "token": "invalid-verification-token"
        })
        assert response.status_code == 400


class TestAccountDeletion:
    """Tests for account deletion."""
    
    def test_delete_account_success(self, client, auth_headers, test_user_data):
        """Successfully delete account with correct password."""
        response = client.request(
            "DELETE",
            "/auth/account", 
            headers=auth_headers,
            json={"password": test_user_data["password"]}
        )
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()
    
    def test_delete_account_wrong_password(self, client, auth_headers):
        """Account deletion fails with wrong password."""
        response = client.request(
            "DELETE",
            "/auth/account",
            headers=auth_headers,
            json={"password": "WrongPassword123!"}
        )
        assert response.status_code == 401


class TestSessionManagement:
    """Tests for session management (logout everywhere)."""
    
    def test_logout_all_sessions(self, client, auth_headers):
        """Logout all sessions succeeds."""
        response = client.post("/auth/logout-all", headers=auth_headers)
        assert response.status_code == 200
        assert "logged out" in response.json()["message"].lower()
    
    def test_logout_all_no_auth(self, client):
        """Logout all requires authentication."""
        response = client.post("/auth/logout-all")
        assert response.status_code == 401


class TestChangePassword:
    """Tests for password change endpoint."""
    
    def test_change_password_success(self, client, auth_headers, test_user_data):
        """Successfully change password."""
        response = client.post("/auth/change-password",
            headers=auth_headers,
            json={
                "current_password": test_user_data["password"],
                "new_password": "NewSecurePass123!"
            }
        )
        assert response.status_code == 200
        assert "success" in response.json()["message"].lower()
    
    def test_change_password_wrong_current(self, client, auth_headers):
        """Change password fails with wrong current password."""
        response = client.post("/auth/change-password",
            headers=auth_headers,
            json={
                "current_password": "WrongPassword123!",
                "new_password": "NewSecurePass123!"
            }
        )
        assert response.status_code == 401
    
    def test_change_password_weak_new(self, client, auth_headers, test_user_data):
        """Change password fails with weak new password."""
        response = client.post("/auth/change-password",
            headers=auth_headers,
            json={
                "current_password": test_user_data["password"],
                "new_password": "weak"
            }
        )
        assert response.status_code == 400


class TestChangeEmail:
    """Tests for email change endpoint."""
    
    def test_change_email_success(self, client, auth_headers, test_user_data):
        """Successfully change email."""
        response = client.post("/auth/change-email",
            headers=auth_headers,
            json={
                "password": test_user_data["password"],
                "new_email": "newemail@example.com"
            }
        )
        assert response.status_code == 200
        assert "success" in response.json()["message"].lower()
    
    def test_change_email_wrong_password(self, client, auth_headers):
        """Change email fails with wrong password."""
        response = client.post("/auth/change-email",
            headers=auth_headers,
            json={
                "password": "WrongPassword123!",
                "new_email": "newemail@example.com"
            }
        )
        assert response.status_code == 401
    
    def test_change_email_invalid_format(self, client, auth_headers, test_user_data):
        """Change email fails with invalid email format."""
        response = client.post("/auth/change-email",
            headers=auth_headers,
            json={
                "password": test_user_data["password"],
                "new_email": "not-an-email"
            }
        )
        assert response.status_code == 400
    
    def test_change_email_duplicate(self, client, auth_headers, test_user_data, test_db):
        """Change email fails if email already exists."""
        # Create another user first
        from backend import models, auth as auth_module
        other_user = models.User(
            email="existing@example.com",
            hashed_password=auth_module.pwd_context.hash("Password123!")
        )
        test_db.add(other_user)
        test_db.commit()
        
        response = client.post("/auth/change-email",
            headers=auth_headers,
            json={
                "password": test_user_data["password"],
                "new_email": "existing@example.com"
            }
        )
        assert response.status_code == 400
        assert "in use" in response.json()["detail"].lower()


class TestMFA:
    """Tests for Multi-Factor Authentication."""
    
    def test_mfa_status_disabled(self, client, auth_headers):
        """MFA status shows disabled for new users."""
        response = client.get("/auth/mfa/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["mfa_enabled"] == False
    
    def test_mfa_setup(self, client, auth_headers):
        """MFA setup returns secret and provisioning URI."""
        response = client.post("/auth/mfa/setup", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "secret" in data
        assert "provisioning_uri" in data
        # Check for issuer (may be URL-encoded)
        assert "Principal" in data["provisioning_uri"]
    
    def test_mfa_verify_invalid_code(self, client, auth_headers):
        """MFA verify fails with invalid code."""
        # First setup
        client.post("/auth/mfa/setup", headers=auth_headers)
        
        # Try invalid code
        response = client.post("/auth/mfa/verify",
            headers=auth_headers,
            json={"code": "000000"}
        )
        assert response.status_code == 400
    
    def test_mfa_verify_valid_code(self, client, auth_headers, test_db, test_user):
        """MFA verify succeeds with valid TOTP code."""
        import pyotp
        
        # Setup MFA
        setup_response = client.post("/auth/mfa/setup", headers=auth_headers)
        secret = setup_response.json()["secret"]
        
        # Generate valid TOTP code
        totp = pyotp.TOTP(secret)
        valid_code = totp.now()
        
        response = client.post("/auth/mfa/verify",
            headers=auth_headers,
            json={"code": valid_code}
        )
        assert response.status_code == 200
        data = response.json()
        assert "backup_codes" in data or "message" in data  # Response format may vary
    
    def test_mfa_disable(self, client, test_db, test_user, test_user_data):
        """MFA can be disabled with password."""
        import pyotp
        from backend import auth as auth_module
        from datetime import timedelta
        
        # Create fresh token for this test
        token = auth_module.create_access_token(
            data={"sub": test_user_data["email"], "tv": 0},
            expires_delta=timedelta(minutes=30)
        )
        headers = {"Authorization": f"Bearer {token}"}
        
        # Setup MFA
        setup_response = client.post("/auth/mfa/setup", headers=headers)
        secret = setup_response.json()["secret"]
        
        # Verify MFA (this increments token version to 1)
        totp = pyotp.TOTP(secret)
        client.post("/auth/mfa/verify", headers=headers, json={"code": totp.now()})
        
        # Refresh the database object to get updated token_version
        test_db.refresh(test_user)
        
        # Generate new token with updated version
        new_token = auth_module.create_access_token(
            data={"sub": test_user_data["email"], "tv": test_user.token_version},
            expires_delta=timedelta(minutes=30)
        )
        new_headers = {"Authorization": f"Bearer {new_token}"}
        
        # Now disable with the new token
        response = client.post("/auth/mfa/disable",
            headers=new_headers,
            json={"password": test_user_data["password"]}
        )
        assert response.status_code == 200
        assert "disabled" in response.json()["message"].lower()
    
    def test_mfa_disable_wrong_password(self, client, auth_headers):
        """MFA disable fails with wrong password."""
        response = client.post("/auth/mfa/disable",
            headers=auth_headers,
            json={"password": "WrongPassword123!"}
        )
        assert response.status_code == 401

