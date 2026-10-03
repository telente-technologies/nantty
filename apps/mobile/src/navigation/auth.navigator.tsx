import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useTheme } from "@/theme";
import { SplashScreen } from "@/screens/auth/splash.screen";
import { OnboardingScreen } from "@/screens/auth/onboarding.screen";
import { WelcomeScreen } from "@/screens/auth/welcome.screen";
import { LoginScreen } from "@/screens/auth/login.screen";
import { ForgotPasswordScreen } from "@/screens/auth/forgotPassword.screen";
import { ResetPasswordScreen } from "@/screens/auth/resetPassword.screen";
import { SignUpContactScreen } from "@/screens/auth/signUpContact.screen";
import { VerifyOtpScreen } from "@/screens/auth/verifyOtp.screen";
import { SignUpBirthdayScreen } from "@/screens/auth/signUpBirthday.screen";
import { SignUpPasswordScreen } from "@/screens/auth/signUpPassword.screen";
import { SignUpUsernameScreen } from "@/screens/auth/signUpUsername.screen";
import { PersonalizationScreen } from "@/screens/auth/personalization.screen";

import type { AuthStackParamList } from "./navigation.types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator({ embeddedMode }: { embeddedMode?: "signup" | "login" }) {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName={embeddedMode ? "Onboarding" : "Splash"}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "slide_from_right" }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} initialParams={embeddedMode ? { mode: embeddedMode, dismissible: true } : undefined} />
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
