import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ReactNode } from "react";

import { colors } from "@/constants/colors.constant";
import { ForcedColorSchemeScope } from "@/theme";
import { SearchScreen } from "@/screens/explore/search.screen";
import { NotificationsScreen } from "@/screens/notifications/notifications.screen";
import { CategoryScreen } from "@/screens/explore/category.screen";
import { ProductDetailScreen } from "@/screens/product/productDetail.screen";
import { ProductReviewsScreen } from "@/screens/product/productReviews.screen";
import { WriteReviewScreen } from "@/screens/product/writeReview.screen";
import { StoreScreen } from "@/screens/store/storeDetail.screen";
import { CartScreen } from "@/screens/cart/cart.screen";
import { CheckoutScreen } from "@/screens/checkout/checkout.screen";
import { PaymentScreen } from "@/screens/checkout/payment.screen";
import { OrderSuccessScreen } from "@/screens/checkout/orderSuccess.screen";
import { OrdersScreen } from "@/screens/orders/orders.screen";
import { OrderDetailScreen } from "@/screens/orders/orderDetail.screen";
import { OpenDisputeScreen } from "@/screens/orders/openDispute.screen";
import { UserProfileScreen } from "@/screens/profile/userProfile.screen";
import { UserProfileByUsernameScreen } from "@/screens/profile/userProfileByUsername.screen";
import { EditProfileScreen } from "@/screens/profile/editProfile.screen";
import { ConnectionsScreen } from "@/screens/profile/connections.screen";
import { SettingsScreen } from "@/screens/settings/settings.screen";
import { SavedScreen } from "@/screens/profile/saved.screen";
import { SettingsAccountScreen } from "@/screens/settings/settingsAccount.screen";
import { SettingsSecurityScreen } from "@/screens/settings/settingsSecurity.screen";
import { AccountStatusScreen } from "@/screens/settings/accountStatus.screen";
import { SettingsNotificationsScreen } from "@/screens/settings/settingsNotifications.screen";
import { SettingsAppPreferenceScreen } from "@/screens/settings/settingsAppPreference.screen";
import { SettingsPaymentMethodsScreen } from "@/screens/settings/settingsPaymentMethods.screen";
import { ShippingAddressesScreen } from "@/screens/settings/shippingAddresses.screen";
import { AddressFormScreen } from "@/screens/settings/addressForm.screen";
import { SettingsSupportScreen } from "@/screens/settings/settingsSupport.screen";
import { SettingsAboutScreen } from "@/screens/settings/settingsAbout.screen";
import { ChangePasswordScreen } from "@/screens/settings/changePassword.screen";
import { ChatNotificationSettingsScreen } from "@/screens/messages/chatNotificationSettings.screen";
import { ChatPasscodeScreen } from "@/screens/messages/chatPasscode.screen";
import { ChatSettingsScreen } from "@/screens/messages/chatSettings.screen";
import { BlockedUsersScreen } from "@/screens/settings/blockedUsers.screen";
import { WalletScreen } from "@/screens/wallet/wallet.screen";
import { StoreRewardsScreen } from "@/screens/wallet/storeRewards.screen";
import { TransactionsScreen } from "@/screens/wallet/transactions.screen";
import { CoinActivityScreen } from "@/screens/wallet/coinActivity.screen";
import { WithdrawScreen } from "@/screens/wallet/withdraw.screen";
import { PayoutSetupScreen } from "@/screens/wallet/payoutSetup.screen";
import { PayoutAccountsScreen } from "@/screens/wallet/payoutAccounts.screen";
import { SellerApplicationScreen } from "@/screens/seller/sellerApplication.screen";
import { SellerDashboardScreen } from "@/screens/seller/sellerDashboard.screen";
import { SellerProductsScreen } from "@/screens/seller/sellerProducts.screen";
import { ProductFormScreen } from "@/screens/seller/productForm.screen";
import { SellerOrdersScreen } from "@/screens/seller/sellerOrders.screen";
import { SellerOrderDetailScreen } from "@/screens/seller/sellerOrderDetail.screen";
import { ChatScreen } from "@/screens/messages/chat.screen";
import { NewMessageScreen } from "@/screens/messages/newMessage.screen";
import { NewGroupScreen } from "@/screens/messages/newGroup.screen";
import { ConversationInfoScreen } from "@/screens/messages/conversationInfo.screen";
import { CreatePostScreen } from "@/screens/create/createPost.screen";
import { PostDetailScreen } from "@/screens/posts/postDetail.screen";
import { PostAnalyticsScreen } from "@/screens/posts/postAnalytics.screen";
import { PostQuotesScreen } from "@/screens/posts/postQuotes.screen";
import { CommentThreadScreen } from "@/screens/posts/commentThread.screen";
import { ContentPreferencesScreen } from "@/screens/settings/contentPreferences.screen";
import { LiveScreen } from "@/screens/live/live.screen";
import { LiveEndedScreen } from "@/screens/live/liveEnded.screen";
import { StoryScreen } from "@/screens/story/story.screen";
import { EscrowStatusScreen } from "@/screens/escrow/escrowStatus.screen";
import { DisputeDetailScreen } from "@/screens/disputes/disputeDetail.screen";
import { SellerApplicationStatusScreen } from "@/screens/seller/sellerApplicationStatus.screen";
import { CreatorProgramScreen } from "@/screens/creator/creatorProgram.screen";
import { CreatorApplicationScreen } from "@/screens/creator/creatorApplication.screen";
import { CreatorApplicationStatusScreen } from "@/screens/creator/creatorApplicationStatus.screen";
import { CreatorDashboardScreen } from "@/screens/creator/creatorDashboard.screen";
import { CreatorSubscribeScreen } from "@/screens/creator/creatorSubscribe.screen";
import { MySubscriptionsScreen } from "@/screens/creator/mySubscriptions.screen";
import { VerificationScreen } from "@/screens/verification/verification.screen";
import { VerificationApplyScreen } from "@/screens/verification/verificationApply.screen";
import { IdentityVerificationScreen } from "@/screens/verification/identityVerification.screen";
import { PromotePostScreen } from "@/screens/boost/promotePost.screen";
import { BoostStatusScreen } from "@/screens/boost/boostStatus.screen";
import { SupportTicketsScreen } from "@/screens/support/supportTickets.screen";
import { NewSupportTicketScreen } from "@/screens/support/newSupportTicket.screen";
import { SupportTicketDetailScreen } from "@/screens/support/supportTicketDetail.screen";
import { MyReportsScreen } from "@/screens/support/myReports.screen";
import { HelpCenterScreen } from "@/screens/support/helpCenter.screen";
import { HelpArticleScreen } from "@/screens/support/helpArticle.screen";
import { HelpCategoryScreen } from "@/screens/support/helpCategory.screen";
import { BusinessDocumentsScreen } from "@/screens/seller/businessDocuments.screen";
import { SettingsUsernameScreen } from "@/screens/settings/settingsUsername.screen";
import { BrandProfileScreen } from "@/screens/brand/brandProfile.screen";
import { CreateBusinessProfileScreen } from "@/screens/brand/createBusinessProfile.screen";
import { FollowRequestsScreen } from "@/screens/profile/followRequests.screen";
import { RankingsScreen } from "@/screens/rankings/rankings.screen";
import { SettingsPrivacyDataScreen } from "@/screens/settings/settingsPrivacyData.screen";
import { SettingsPrivacyScreen } from "@/screens/settings/settingsPrivacy.screen";
import { CreateBrandScreen } from "@/screens/brand/createBrand.screen";

import { guestGateScreenLayout } from "@/components/auth/guestGate";
import { AuthFlowScreen } from "@/screens/auth/authFlow.screen";

import { MainTabsNavigator } from "./mainTabs.navigator";
import type { MainStackParamList } from "./navigation.types";
import { SoundScreen } from "@/screens/sounds/sound.screen";

const Stack = createNativeStackNavigator<MainStackParamList>();
const modal = { presentation: "fullScreenModal", animation: "slide_from_bottom" } as const;
const dark = { animation: "fade", contentStyle: { backgroundColor: colors.black } } as const;
const keepOnDarkFirstPalette = ({ route, children }: { route: { name: string }; children: ReactNode }) =>
  guestGateScreenLayout({ route, children: <ForcedColorSchemeScope scheme="light">{children}</ForcedColorSchemeScope> });

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }} screenLayout={guestGateScreenLayout}>
      <Stack.Screen name="Tabs" component={MainTabsNavigator} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Category" component={CategoryScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="ProductReviews" component={ProductReviewsScreen} />
      <Stack.Screen name="WriteReview" component={WriteReviewScreen} />
      <Stack.Screen name="Store" component={StoreScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="OpenDispute" component={OpenDisputeScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="UserProfileByUsername" component={UserProfileByUsernameScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Connections" component={ConnectionsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SettingsAccount" component={SettingsAccountScreen} />
      <Stack.Screen name="AccountStatus" component={AccountStatusScreen} />
      <Stack.Screen name="SettingsSecurity" component={SettingsSecurityScreen} />
      <Stack.Screen name="SettingsNotifications" component={SettingsNotificationsScreen} />
      <Stack.Screen name="SettingsAppPreference" component={SettingsAppPreferenceScreen} />
      <Stack.Screen name="SettingsPaymentMethods" component={SettingsPaymentMethodsScreen} />
      <Stack.Screen name="ShippingAddresses" component={ShippingAddressesScreen} />
      <Stack.Screen name="AddressForm" component={AddressFormScreen} />
      <Stack.Screen name="SettingsSupport" component={SettingsSupportScreen} />
      <Stack.Screen name="SettingsAbout" component={SettingsAboutScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} />
      <Stack.Screen name="ChatNotificationSettings" component={ChatNotificationSettingsScreen} />
      <Stack.Screen name="ChatPasscode" component={ChatPasscodeScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="StoreRewards" component={StoreRewardsScreen} />
      <Stack.Screen name="CoinActivity" component={CoinActivityScreen} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="PayoutAccounts" component={PayoutAccountsScreen} />
      <Stack.Screen name="PayoutSetup" component={PayoutSetupScreen} />
      <Stack.Screen name="SellerApplication" component={SellerApplicationScreen} />
      <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} />
      <Stack.Screen name="SellerProducts" component={SellerProductsScreen} />
      <Stack.Screen name="ProductForm" component={ProductFormScreen} />
      <Stack.Screen name="SellerOrders" component={SellerOrdersScreen} />
      <Stack.Screen name="SellerOrderDetail" component={SellerOrderDetailScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="NewMessage" component={NewMessageScreen} options={modal} />
      <Stack.Screen name="NewGroup" component={NewGroupScreen} options={modal} />
      <Stack.Screen name="ConversationInfo" component={ConversationInfoScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={modal} layout={keepOnDarkFirstPalette} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="PostAnalytics" component={PostAnalyticsScreen} />
      <Stack.Screen name="PostQuotes" component={PostQuotesScreen} />
      <Stack.Screen name="CommentThread" component={CommentThreadScreen} />
      <Stack.Screen name="ContentPreferences" component={ContentPreferencesScreen} />
      <Stack.Screen name="Live" component={LiveScreen} options={dark} layout={keepOnDarkFirstPalette} />
      <Stack.Screen name="LiveEnded" component={LiveEndedScreen} options={dark} layout={keepOnDarkFirstPalette} />
      <Stack.Screen name="Story" component={StoryScreen} options={dark} layout={keepOnDarkFirstPalette} />
      <Stack.Screen name="EscrowStatus" component={EscrowStatusScreen} />
      <Stack.Screen name="DisputeDetail" component={DisputeDetailScreen} />
      <Stack.Screen name="SellerApplicationStatus" component={SellerApplicationStatusScreen} />
      <Stack.Screen name="CreatorProgram" component={CreatorProgramScreen} />
      <Stack.Screen name="CreatorApplication" component={CreatorApplicationScreen} />
      <Stack.Screen name="CreatorApplicationStatus" component={CreatorApplicationStatusScreen} />
      <Stack.Screen name="CreatorDashboard" component={CreatorDashboardScreen} />
      <Stack.Screen name="CreatorSubscribe" component={CreatorSubscribeScreen} />
      <Stack.Screen name="MySubscriptions" component={MySubscriptionsScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="VerificationApply" component={VerificationApplyScreen} />
      <Stack.Screen name="IdentityVerification" component={IdentityVerificationScreen} />
      <Stack.Screen name="PromotePost" component={PromotePostScreen} />
      <Stack.Screen name="BoostStatus" component={BoostStatusScreen} />
      <Stack.Screen name="SupportTickets" component={SupportTicketsScreen} />
      <Stack.Screen name="NewSupportTicket" component={NewSupportTicketScreen} />
      <Stack.Screen name="SupportTicketDetail" component={SupportTicketDetailScreen} />
      <Stack.Screen name="MyReports" component={MyReportsScreen} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <Stack.Screen name="HelpArticle" component={HelpArticleScreen} />
      <Stack.Screen name="HelpCategory" component={HelpCategoryScreen} />
      <Stack.Screen name="BusinessDocuments" component={BusinessDocumentsScreen} />
      <Stack.Screen name="SettingsUsername" component={SettingsUsernameScreen} />
      <Stack.Screen name="BrandProfile" component={BrandProfileScreen} />
      <Stack.Screen name="CreateBrand" component={CreateBrandScreen} />
      <Stack.Screen name="FollowRequests" component={FollowRequestsScreen} />
      <Stack.Screen name="SettingsPrivacy" component={SettingsPrivacyScreen} />
      <Stack.Screen name="SettingsPrivacyData" component={SettingsPrivacyDataScreen} />
      <Stack.Screen name="CreateBusinessProfile" component={CreateBusinessProfileScreen} />
      <Stack.Screen name="Rankings" component={RankingsScreen} />
      <Stack.Screen name="Saved" component={SavedScreen} />
      <Stack.Screen name="Sound" component={SoundScreen} />
      <Stack.Screen name="AuthFlow" component={AuthFlowScreen} options={modal} />
    </Stack.Navigator>
  );
}
