import { AuthProvider } from "./auth/AuthProvider";
import { MessengerRoot } from "./MessengerRoot";

export function App() {
  return (
    <AuthProvider>
      <MessengerRoot />
    </AuthProvider>
  );
}
