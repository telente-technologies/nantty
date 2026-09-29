import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { colors } from "@/constants/colors.constant";
import { SearchScreen } from "@/screens/explore/search.screen";
import { NotificationsScreen } from "@/screens/notifications/notifications.screen";
import { CategoryScreen } from "@/screens/explore/category.screen";
import { ProductDetailScreen } from "@/screens/product/productDetail.screen";
import { ProductReviewsScreen } from "@/screens/product/productReviews.screen";
import { StoreScreen } from "@/screens/store/storeDetail.screen";
import { CartScreen } from "@/screens/cart/cart.screen";
import { CheckoutScreen } from "@/screens/checkout/checkout.screen";
import { PaymentScreen } from "@/screens/checkout/payment.screen";
import { OrderSuccessScreen } from "@/screens/checkout/orderSuccess.screen";
import { OrdersScreen } from "@/screens/orders/orders.screen";
import { OrderDetailScreen } from "@/screens/orders/orderDetail.screen";
import { OpenDisputeScreen } from "@/screens/orders/openDispute.screen";
import { UserProfileScreen } from "@/screens/profile/userProfile.screen";
import { EditProfileScreen } from "@/screens/profile/editProfile.screen";
import { ConnectionsScreen } from "@/screens/profile/connections.screen";
import { SettingsScreen } from "@/screens/settings/settings.screen";
import { SettingsAccountScreen } from "@/screens/settings/settingsAccount.screen";
import { SettingsSecurityScreen } from "@/screens/settings/settingsSecurity.screen";
import { SettingsNotificationsScreen } from "@/screens/settings/settingsNotifications.screen";
import { SettingsAppPreferenceScreen } from "@/screens/settings/settingsAppPreference.screen";
import { SettingsPaymentMethodsScreen } from "@/screens/settings/settingsPaymentMethods.screen";
import { ShippingAddressesScreen } from "@/screens/settings/shippingAddresses.screen";
import { AddressFormScreen } from "@/screens/settings/addressForm.screen";
import { SettingsSupportScreen } from "@/screens/settings/settingsSupport.screen";
import { SettingsAboutScreen } from "@/screens/settings/settingsAbout.screen";
import { ChangePasswordScreen } from "@/screens/settings/changePassword.screen";
import { BlockedUsersScreen } from "@/screens/settings/blockedUsers.screen";
import { WalletScreen } from "@/screens/wallet/wallet.screen";
import { TransactionsScreen } from "@/screens/wallet/transactions.screen";
import { WithdrawScreen } from "@/screens/wallet/withdraw.screen";
import { PayoutAccountsScreen } from "@/screens/wallet/payoutAccounts.screen";
import { SellerApplicationScreen } from "@/screens/seller/sellerApplication.screen";
import { SellerDashboardScreen } from "@/screens/seller/sellerDashboard.screen";
import { SellerProductsScreen } from "@/screens/seller/sellerProducts.screen";
import { ProductFormScreen } from "@/screens/seller/productForm.screen";
import { SellerOrdersScreen } from "@/screens/seller/sellerOrders.screen";
import { SellerOrderDetailScreen } from "@/screens/seller/sellerOrderDetail.screen";
import { ChatScreen } from "@/screens/messages/chat.screen";
import { NewMessageScreen } from "@/screens/messages/newMessage.screen";
import { CreatePostScreen } from "@/screens/create/createPost.screen";
import { PostDetailScreen } from "@/screens/posts/postDetail.screen";
import { LiveScreen } from "@/screens/live/live.screen";
import { LiveEndedScreen } from "@/screens/live/liveEnded.screen";
import { StoryScreen } from "@/screens/story/story.screen";

import { MainTabsNavigator } from "./mainTabs.navigator";
import type { MainStackParamList } from "./navigation.types";

const Stack = createNativeStackNavigator<MainStackParamList>();
const modal = { presentation: "fullScreenModal", animation: "slide_from_bottom" } as const;
const dark = { animation: "fade", contentStyle: { backgroundColor: colors.black } } as const;

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="Tabs" component={MainTabsNavigator} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Category" component={CategoryScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="ProductReviews" component={ProductReviewsScreen} />
      <Stack.Screen name="Store" component={StoreScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="OpenDispute" component={OpenDisputeScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Connections" component={ConnectionsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SettingsAccount" component={SettingsAccountScreen} />
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
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="PayoutAccounts" component={PayoutAccountsScreen} />
      <Stack.Screen name="SellerApplication" component={SellerApplicationScreen} />
      <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} />
      <Stack.Screen name="SellerProducts" component={SellerProductsScreen} />
      <Stack.Screen name="ProductForm" component={ProductFormScreen} />
      <Stack.Screen name="SellerOrders" component={SellerOrdersScreen} />
      <Stack.Screen name="SellerOrderDetail" component={SellerOrderDetailScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="NewMessage" component={NewMessageScreen} options={modal} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={modal} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="Live" component={LiveScreen} options={dark} />
      <Stack.Screen name="LiveEnded" component={LiveEndedScreen} options={dark} />
      <Stack.Screen name="Story" component={StoryScreen} options={dark} />
    </Stack.Navigator>
  );
}
