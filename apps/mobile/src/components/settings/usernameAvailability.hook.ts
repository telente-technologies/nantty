import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { usersService } from "@/services/users.service";
import type { UsernameUnavailableReason } from "@/types/account.type";
import { isValidUsername } from "@/utils/validators.util";

export const USERNAME_UNAVAILABLE_MESSAGES: Record<UsernameUnavailableReason, string> = {
  taken: "That username is taken",
  reserved: "That username is reserved for Zudomart and can't be used.",
  invalid: "Use 3–20 letters, numbers, underscores or full stops.",
  recently_used: "That username was used recently and isn't available yet.",
  withheld: "That username has been withheld under our policies.",
};

export function useUsernameAvailability(username: string, currentUsername?: string, displayName?: string) {
  const [debouncedUsername, setDebouncedUsername] = useState(username);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUsername(username.trim()), 350);
    return () => clearTimeout(timer);
  }, [username]);
  const formatIsValid = isValidUsername(debouncedUsername);
  const unchanged = !!currentUsername && debouncedUsername.toLowerCase() === currentUsername.toLowerCase();
  const availability = useQuery({
    queryKey: ["username-availability", debouncedUsername.toLowerCase()],
    queryFn: () => usersService.checkUsernameAvailability(debouncedUsername, displayName),
    enabled: formatIsValid && !unchanged,
    staleTime: 30_000,
  });
  const settled = debouncedUsername === username.trim() && !availability.isFetching;
  const message = !username.trim()
    ? null
    : !isValidUsername(username.trim())
      ? USERNAME_UNAVAILABLE_MESSAGES.invalid
      : unchanged
        ? "This is your current username."
        : !settled
          ? "Checking…"
          : availability.data?.available
            ? `@${debouncedUsername} is available`
            : availability.data?.reason
              ? availability.data.message ?? USERNAME_UNAVAILABLE_MESSAGES[availability.data.reason]
              : null;
  const suggestions = settled && availability.data?.available === false ? (availability.data.suggestions ?? []) : [];
  return { isAvailable: settled && formatIsValid && !unchanged && availability.data?.available === true, message, checking: !settled, suggestions };
}
