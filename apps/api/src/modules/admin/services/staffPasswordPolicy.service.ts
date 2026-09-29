import { adminError } from "../../../utils/adminHttp.util.js";

export const STAFF_PASSWORD_MIN_LENGTH = 12;
export const STAFF_PASSWORD_MAX_LENGTH = 128;

export function findStaffPasswordProblems(password: string, email: string, name: string): readonly string[] {
  const problems: string[] = [];
  if (password.length < STAFF_PASSWORD_MIN_LENGTH || password.length > STAFF_PASSWORD_MAX_LENGTH) {
    problems.push(`Use ${STAFF_PASSWORD_MIN_LENGTH}-${STAFF_PASSWORD_MAX_LENGTH} characters.`);
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) problems.push("Mix upper and lower case letters.");
  if (!/\d/.test(password)) problems.push("Include a number.");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("Include a symbol.");
  const lowered = password.toLowerCase();
  const personalParts = [email.split("@")[0] ?? "", ...name.toLowerCase().split(/\s+/)].filter((part) => part.length >= 4);
  if (personalParts.some((part) => lowered.includes(part.toLowerCase()))) problems.push("Do not use your name or email in the password.");
  if (/(.)\1{3,}/.test(password)) problems.push("Avoid repeating the same character.");
  return problems;
}

export function assertStaffPasswordIsStrong(password: string, email: string, name: string): void {
  const problems = findStaffPasswordProblems(password, email, name);
  if (problems.length > 0) {
    throw adminError(400, "VALIDATION_FAILED", "Choose a stronger password.", { issues: problems.map((message) => ({ path: "password", message })) });
  }
}
