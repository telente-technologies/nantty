import { ApiError } from "@/errors/api.error";
import { usersService } from "@/services/account/users.service";

export async function requireVerifiedCheckoutEmail() {
  const profile = await usersService.fetchMyProfile();
  if (profile.emailVerified !== true) {
    throw new ApiError(403, "Verify your email to continue.", "VERIFY_EMAIL_REQUIRED");
  }
  return profile;
}
