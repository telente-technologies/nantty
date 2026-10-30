import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { creatorQueryKeys, useMySubscriptionsQuery } from "@/components/creator/creatorQueries.hook";
import { Gift24Icon } from "@/components/icons";
import { ProfileHeaderBar } from "@/components/profile/profileHeaderBar";
import { TipSheet } from "@/components/coins/tipSheet";
import { TransferCoinsSheet } from "@/components/coins/transferCoinsSheet";
import { ProfileMoreSheet } from "@/components/profile/profileMoreSheet";
import { useFollowUserToggle } from "@/components/profile/confirmedFollowToggle.hook";
import { PostNotificationLevelIcon, PostNotificationsSheet } from "@/components/profile/postNotificationsSheet";
import { useFollowStatusQuery, useSetPostNotificationsMutation, useUserPostsQuery, useUserProfileQuery } from "@/components/profile/profileQueries.hook";
import type { ProfileAction } from "@/components/profile/profileSummary";
import { followButtonLabelForState, isFollowStateHighlighted, lockedProfileCopyByLock, resolveFollowStateOfUser, resolveProfileLock } from "@/components/profile/followState.util";
import { useUnblockFromProfile } from "@/components/profile/unblockFromProfile.hook";
import { SuspendedProfileState } from "@/components/profile/suspendedProfileState";
import { ProfileView } from "@/components/profile/profileView";
import { hasSubscriberOnlyPosts } from "@/components/profile/subscriberPosts.util";
import { ErrorState } from "@/components/ui/errorState";
import { Screen } from "@/components/ui/screen";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { creatorProgramService } from "@/services/creators/creatorProgram.service";
import { useAuthStore } from "@/store/auth.store";
import { userProfileShowsMart } from "@/utils/linkedProfiles.util";
import { requireAuthThen } from "@/utils/requireAuth.util";

export function UserProfileScreen({ navigation, route }: MainScreenProps<"UserProfile">) {
  const { colors } = useTheme();
  const { userId } = route.params;
  const signedInUserId = useAuthStore((state) => state.user?.id);
  const viewingOwnProfile = userId === signedInUserId;
  const profileQuery = useUserProfileQuery(userId);
  const { toggleUser } = useFollowUserToggle();
  const unblockFromProfile = useUnblockFromProfile();
  const followStatusQuery = useFollowStatusQuery(userId, !viewingOwnProfile && !!signedInUserId);
  const followStatus = followStatusQuery.data;
  const setPostNotifications = useSetPostNotificationsMutation(userId);
  const [isBellSheetOpen, setIsBellSheetOpen] = useState(false);
  const subscriptionPlans = useQuery({
    queryKey: creatorQueryKeys.plansOfCreator(userId),
    queryFn: () => creatorProgramService.listSubscriptionPlansOfCreator(userId),
    enabled: !viewingOwnProfile,
  });
  const mySubscriptions = useMySubscriptionsQuery(!viewingOwnProfile && !!signedInUserId);
  const hasActivePlans = (subscriptionPlans.data?.length ?? 0) > 0;
  const alreadySubscribed = (mySubscriptions.data ?? []).some((item) => item.creatorId === userId && item.status === "active");
  const [moreSheetVisible, setMoreSheetVisible] = useState(false);
  const [isTransferCoinsSheetOpen, setIsTransferCoinsSheetOpen] = useState(false);
  const [isProfileGiftSheetOpen, setIsProfileGiftSheetOpen] = useState(false);
  const fetchedProfile = profileQuery.data;
  const profile = fetchedProfile && followStatus ? { ...fetchedProfile, followState: followStatus.state, isFollowing: followStatus.state === "accepted" } : fetchedProfile;
  const followState = profile ? resolveFollowStateOfUser(profile) : "none";
  const postNotificationLevel = followStatus?.viewerPostNotifications ?? "off";
  const showBell = !!signedInUserId && !viewingOwnProfile && followState === "accepted";
  const profileLock = profile ? resolveProfileLock(profile) : "open";
  const isContentHidden = profileLock !== "open";
  const postsQuery = useUserPostsQuery(profile && !isContentHidden ? userId : undefined);
  const showsSubscriberPosts = !!profile?.isCreator || hasActivePlans;
  const subscriberPostsQuery = useUserPostsQuery(profile && !isContentHidden ? userId : undefined, "subscribers", showsSubscriberPosts);
  const hasSubscriberPosts = hasSubscriberOnlyPosts(subscriberPostsQuery.data?.data);
  const showsMart = userProfileShowsMart(profile);

  useEffect(() => {
    if (viewingOwnProfile) navigation.replace("Tabs", { screen: "Me" });
  }, [viewingOwnProfile, navigation]);

  const actions: ProfileAction[] = profile
    ? [
        {
          label: followButtonLabelForState(followState),
          onPress: () => requireAuthThen(() => (followState === "blocked" ? unblockFromProfile({ id: userId, username: profile.username }) : toggleUser({ id: userId, username: profile.username, followState, isPrivate: profile.isPrivate })), undefined, "follow people"),
          highlighted: isFollowStateHighlighted(followState),
        },
        { label: "Message", onPress: () => requireAuthThen(() => navigation.navigate("Chat", { userId, name: profile.name }), undefined, "send messages") },
        ...(showBell
          ? [{
              label: "Post notifications",
              accessibilityLabel: `Post notifications for @${profile.username}: ${postNotificationLevel === "off" ? "off" : postNotificationLevel === "posts" ? "all posts" : "posts and lives"}`,
              icon: <PostNotificationLevelIcon level={postNotificationLevel} color={postNotificationLevel === "off" ? colors.text : colors.primary} />,
              onPress: () => setIsBellSheetOpen(true),
            }]
          : []),
        ...(profile.isCreator && !isContentHidden && followState !== "blocked"
          ? [{
              label: "Gift",
              accessibilityLabel: `Gift coins to ${profile.name}`,
              icon: <Gift24Icon size={20} color={colors.textMuted} />,
              onPress: () => requireAuthThen(() => setIsProfileGiftSheetOpen(true), undefined, "gift creators"),
            }]
          : []),
        ...(showsMart && profile.storeId ? [{ label: "View Shop", onPress: () => navigation.navigate("Store", { storeId: profile.storeId! }) }] : []),
      ]
    : [];

  const identityAction: ProfileAction | undefined =
    !viewingOwnProfile && hasActivePlans
      ? alreadySubscribed
        ? { label: "Subscribed", onPress: () => navigation.navigate("MySubscriptions") }
        : { label: "Subscribe", onPress: () => requireAuthThen(() => navigation.navigate("CreatorSubscribe", { creatorId: userId }), undefined, "subscribe to creators"), highlighted: true }
      : undefined;

  return (
    <Screen background={colors.surface}>
      <ProfileHeaderBar
        variant="other"
        onBack={() => navigation.goBack()}
        onSearch={() => navigation.navigate("Search", profile ? { scope: `profile:${userId}`, scopeLabel: `@${profile.username}` } : { scope: "global" })}
        onMore={() => setMoreSheetVisible(true)}
      />
      {profileQuery.isError && !profile ? (
        <ErrorState error={profileQuery.error} message="Couldn't load this profile." onRetry={() => profileQuery.refetch()} retrying={profileQuery.isRefetching} />
      ) : profile?.account?.status === "suspended" ? <SuspendedProfileState profile={profile} /> : (
      <ProfileView
        profile={viewingOwnProfile ? undefined : profile}
        posts={postsQuery.data?.data ?? []}
        variant="other"
        tabs={[
          "posts",
          "reposts",
          "clips",
          ...(hasSubscriberPosts ? (["subscribers"] as const) : []),
          ...(profile?.isCreator || (subscriptionPlans.data?.length ?? 0) > 0 ? (["sounds"] as const) : []),
          ...(showsMart ? (["store"] as const) : []),
        ]}
        actions={actions}
        isLocked={isContentHidden}
        subscriberPosts={subscriberPostsQuery.data?.data ?? []}
        lockedCopy={profileLock === "open" ? undefined : lockedProfileCopyByLock[profileLock]}
        identityAction={identityAction}
        loading={postsQuery.isLoading}
        subscriberPostsLoading={subscriberPostsQuery.isLoading}
        subscriberSubscriptionAvailable={hasActivePlans}
        onPressSubscribe={() => requireAuthThen(() => navigation.navigate("CreatorSubscribe", { creatorId: userId }), undefined, "subscribe to creators")}
        refreshing={profileQuery.isRefetching || postsQuery.isRefetching || subscriberPostsQuery.isRefetching}
        onRefresh={() => {
          profileQuery.refetch();
          if (signedInUserId) followStatusQuery.refetch();
          if (!isContentHidden) postsQuery.refetch();
          if (!isContentHidden && showsSubscriberPosts) subscriberPostsQuery.refetch();
        }}
        onPressFollowers={() => (isContentHidden ? undefined : navigation.navigate("Connections", { userId, tab: "followers" }))}
        onPressFollowing={() => (isContentHidden ? undefined : navigation.navigate("Connections", { userId, tab: "following" }))}
        onPressPost={(post) => navigation.navigate("PostDetail", { postId: post.id })}
        onOpenStoreTab={showsMart && profile?.storeId ? () => navigation.navigate("Store", { storeId: profile.storeId! }) : undefined}
      />
      )}
      {profile && profile.account?.status !== "suspended" ? (
        <ProfileMoreSheet
          profile={profile}
          visible={moreSheetVisible}
          onClose={() => setMoreSheetVisible(false)}
          onBlocked={() => navigation.goBack()}
          onSendCoins={profile.isCreator ? undefined : () => setIsTransferCoinsSheetOpen(true)}
        />
      ) : null}
      {profile && showBell ? (
        <PostNotificationsSheet
          visible={isBellSheetOpen}
          onClose={() => setIsBellSheetOpen(false)}
          username={profile.username}
          level={postNotificationLevel}
          onSelect={(level) => setPostNotifications.mutate(level)}
        />
      ) : null}
      <TransferCoinsSheet
        visible={isTransferCoinsSheetOpen}
        recipient={profile ?? null}
        onClose={() => setIsTransferCoinsSheetOpen(false)}
      />
      <TipSheet
        target={profile && profile.isCreator && isProfileGiftSheetOpen ? { targetType: "profile", targetId: userId, creatorName: profile.name } : null}
        onClose={() => setIsProfileGiftSheetOpen(false)}
      />
    </Screen>
  );
}
