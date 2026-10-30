import { Component, type ErrorInfo, type ReactElement, type ReactNode } from "react";
import { ScrollView } from "react-native";

import type { ErrorStateVariant } from "./errorState";
import { ErrorState } from "./errorState";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly variant?: ErrorStateVariant;
  readonly resetKey?: string;
  readonly onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
  readonly resetKey?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private readonly retry = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const signal = this.state.error as Error & { status?: number; code?: string };
    const isRenderCrash = signal.status === undefined && signal.code === undefined;
    const variant = this.props.variant ?? "page";
    const recovery = <ErrorState error={this.state.error} kind={isRenderCrash ? "serverError" : undefined} title={isRenderCrash ? "This screen hit a snag" : undefined} description={isRenderCrash ? "This screen couldn't load. Try again, or return to the previous screen." : undefined} variant={variant} onRetry={this.retry} />;
    return variant === "page" ? <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{recovery}</ScrollView> : recovery;
  }
}

export function withScreenErrorBoundary<LayoutProps extends { route: { name: string; key?: string }; children: ReactNode }>(layout: (props: LayoutProps) => ReactElement) {
  return function ScreenLayoutWithBoundary(props: LayoutProps): ReactElement {
    return layout({ ...props, children: <ErrorBoundary resetKey={props.route.key}>{props.children}</ErrorBoundary> });
  };
}
