"use client";

import { useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";

type PlaidLinkHostProps = {
  token: string;
  onSuccess: (publicToken: string) => void;
  onExit: () => void;
};

/** Mount when you have a link_token; opens Link when ready. */
export function PlaidLinkHost({ token, onSuccess, onExit }: PlaidLinkHostProps) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken) => onSuccess(publicToken),
    onExit: () => onExit(),
  });

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  return null;
}
