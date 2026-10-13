"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NetworkSelector } from "@/components/NetworkSelector";
import { PushSubscribeButton } from "@/components/PushSubscribeButton";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavLinkItem {
  href: string;
  label: string;
}

const NAV_LINKS: NavLinkItem[] = [
  { href: "/live", label: "Live" },
  { href: "/contracts", label: "Contracts" },
  { href: "/events", label: "Events" },
  { href: "/watchdog", label: "Watchdog" },
  { href: "/groups", label: "Groups" },
  { href: "/rules", label: "Rules" },
  { href: "/playground", label: "Playground" },
  { href: "/settings", label: "Settings" },
];

export function MobileNavDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Open and lock scroll
  const openDrawer = () => {
    setIsOpen(true);
  };

  const closeDrawer = () => {
    setIsOpen(false);
  };

  // Manage body scroll locking and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus close button on open
    const focusTimeout = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDrawer();
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusableElements =
          drawerRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(focusTimeout);
    };
  }, [isOpen]);

  const handleSearchClick = () => {
    closeDrawer();
    window.dispatchEvent(new CustomEvent("sorolens:open-search"));
  };

  return (
    <div className="md:hidden">
      {/* Hamburger Trigger */}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open mobile menu"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-drawer"
        data-testid="mobile-menu-trigger"
        onClick={openDrawer}
        className="flex items-center justify-center p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="fixed inset-0 z-50 flex justify-end"
        >
          {/* Backdrop */}
          <div
            data-testid="drawer-backdrop"
            onClick={closeDrawer}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div
            ref={drawerRef}
            className="relative z-50 flex h-full w-full max-w-xs flex-col justify-between border-l border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-2xl overflow-y-auto"
          >
            <div>
              {/* Header inside drawer */}
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                <Link
                  href="/"
                  onClick={closeDrawer}
                  className="flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--color-text-primary)]"
                >
                  <img src="/logo.svg" alt="" className="h-7 w-7" aria-hidden />
                  Sorolens
                </Link>
                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="Close mobile menu"
                  data-testid="close-drawer-btn"
                  onClick={closeDrawer}
                  className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Mobile Search Button */}
              <div className="mt-4">
                <button
                  type="button"
                  data-testid="drawer-search-btn"
                  onClick={handleSearchClick}
                  className="flex w-full items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-2.5 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="opacity-70"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Search contracts…</span>
                </button>
              </div>

              {/* Navigation Links */}
              <nav
                className="mt-6 flex flex-col space-y-1"
                aria-label="Mobile Navigation"
              >
                {NAV_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeDrawer}
                    className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-base font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Bottom Utilities */}
            <div className="mt-8 border-t border-[var(--color-border)] pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Network
                </span>
                <NetworkSelector />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Push Alerts
                </span>
                <PushSubscribeButton />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Theme
                </span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
