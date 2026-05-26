import type { ReactNode } from 'react';

export function EmptyStateCard(props: {
  title: string;
  message?: string;
  hint?: string;
  action?: ReactNode;
}): JSX.Element;
