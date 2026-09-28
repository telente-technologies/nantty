import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { colors } from "@/constants/colors.constant";
import { SplashScreen } from "@/screens/auth/splash.screen";
import { OnboardingScreen } from "@/screens/auth/onboarding.screen";
import { WelcomeScreen } from "@/screens/auth/welcome.screen";
import { LoginScreen } from "@/screens/auth/login.screen";
import { ForgotPasswordScreen } from "@/screens/auth/forgot-password.screen";
import { ResetPasswordScreen } from "@/screens/auth/reset-password.screen";
import { SignUpContactScreen } from "@/screens/auth/sign-up-contact.screen";
import { VerifyOtpScreen } from "@/screens/auth/verify-otp.screen";
import { SignUpBirthdayScreen } from "@/screens/auth/sign-up-birthday.screen";
import { SignUpPasswordScreen } from "@/screens/auth/sign-up-password.screen";
import { SignUpUsernameScreen } from "@/screens/auth/sign-up-username.screen";
import { PersonalizationScreen } from "@/screens/auth/personalization.screen";

import type { AuthStackParamList } from "./navigation.types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "slide_from_right" }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="SignUpContact" component={SignUpContactScreen} />
      <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
      <Stack.Screen name="SignUpBirthday" component={SignUpBirthdayScreen} />
      <Stack.Screen name="SignUpPassword" component={SignUpPasswordScreen} />
      <Stack.Screen name="SignUpUsername" component={SignUpUsernameScreen} />
      <Stack.Screen name="Personalization" component={PersonalizationScreen} />
    </Stack.Navigator>
  );
}
