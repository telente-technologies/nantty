"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { authService } from "@/services/auth.service";

import { isValidUsername, USERNAME_UNAVAILABLE_MESSAGES } from "./signupRules.util";

export function useUsernameAvailability(username: string, isEnabled: boolean) {
  const [debouncedUsername, setDebouncedUsername] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUsername(username.trim()), 350);
    return () => clearTimeout(timer);
  }, [username]);

  const usernameQuery = useQuery({
    queryKey: ["username-availability", debouncedUsername.toLowerCase()],
    queryFn: () => authService.checkUsernameAvailability(debouncedUsername),
    enabled: isValidUsername(debouncedUsername) && isEnabled,
    staleTime: 30_000,
    retry: false,
  });

  const isSettled = debouncedUsername === username.trim() && !usernameQuery.isFetching;
  const isAvailable = usernameQuery.data?.available ?? null;
  const availableMessage = `@${debouncedUsername} is available`;

  const availabilityMessage = !username.trim()
    ? null
    : !isValidUsername(username.trim())
      ? USERNAME_UNAVAILABLE_MESSAGES.invalid
      : !isSettled
        ? "Checking…"
        : isAvailable
          ? availableMessage
          : usernameQuery.data?.reason
            ? (USERNAME_UNAVAILABLE_MESSAGES[usernameQuery.data.reason] ?? "That username isn't available. Try another one.")
            : null;

  const suggestions = isSettled && usernameQuery.data?.available === false ? (usernameQuery.data.suggestions ?? []) : [];

  return {
    suggestions,
    availabilityMessage,
    isAvailableMessage: availabilityMessage === availableMessage,
    isUsernameUsable: isSettled && isValidUsername(username.trim()) && isAvailable === true,
  };
}
