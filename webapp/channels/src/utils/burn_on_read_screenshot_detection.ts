// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * ScreenshotDetectionManager
 *
 * A singleton manager that provides screenshot deterrence for Burn-on-Read messages.
 * It handles two main protection mechanisms:
 *
 * 1. Screenshot shortcut detection: Monitors keyboard for screenshot shortcuts
 *    (Cmd+Shift+3/4/5 on Mac, Windows+Shift+S or PrintScreen on Windows)
 *    and triggers a callback when detected.
 *
 * 2. Window blur protection: Applies a CSS class to blur BoR content when
 *    the browser window loses focus (e.g., switching to another app).
 *
 * The manager uses a reference counting pattern to ensure listeners are only
 * registered when at least one BoR timer chip is visible, and automatically
 * cleaned up when all chips are unmounted.
 *
 * @example
 * // In a React component:
 * useEffect(() => {
 *     screenshotDetectionManager.register(() => showWarningModal());
 *     return () => screenshotDetectionManager.unregister();
 * }, []);
 */

/** Callback invoked when a screenshot attempt is detected */
type ScreenshotDetectedCallback = () => void;

/** Timer handle type compatible with both Node.js and browser environments */
type TimeoutHandle = ReturnType<typeof setTimeout>;

// Configuration constants
const SCREENSHOT_DETECTION_DELAY_MS = 350; // Time to wait before triggering warning after Cmd+Shift
const CALLBACK_THROTTLE_MS = 2000; // Minimum time between callback invocations
const BLUR_SETTLE_DELAY_MS = 100; // Time to let focus settle before checking document.hasFocus()

/**
 * Detects the current operating system platform.
 * Uses modern navigator.userAgentData when available, falls back to userAgent parsing.
 */
function detectPlatform(): {isMac: boolean; isWindows: boolean; isLinux: boolean} {
    // Try modern API first (Chromium-based browsers)
    const userAgentData = (navigator as Navigator & {userAgentData?: {platform?: string}}).userAgentData;
    if (userAgentData?.platform) {
        const platform = userAgentData.platform.toUpperCase();
        return {
            isMac: platform.includes('MAC'),
            isWindows: platform.includes('WIN'),
            isLinux: platform.includes('LINUX'),
        };
    }

    // Fallback to userAgent parsing
    const ua = navigator.userAgent.toUpperCase();
    return {
        isMac: ua.includes('MAC'),
        isWindows: ua.includes('WIN'),
        isLinux: ua.includes('LINUX'),
    };
}

/** CSS class applied to document.body when window loses focus */
const BLUR_CLASS = 'bor-window-blurred';

class ScreenshotDetectionManager {
    private listenerCount = 0;
    private isListenerRegistered = false;
    private callback: ScreenshotDetectedCallback | null = null;

    // Event handler references for cleanup
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
    private blurHandler: (() => void) | null = null;
    private focusHandler: (() => void) | null = null;
    private visibilityChangeHandler: (() => void) | null = null;

    // Keyboard state tracking
    private cmdKeyPressed = false;
    private shiftKeyPressed = false;
    private otherKeyPressed = false;
    private lastCallbackTime = 0;
    private warningTimeout: TimeoutHandle | null = null;

    /**
     * Registers a callback to be invoked when a screenshot attempt is detected.
     * Multiple registrations increment a reference count; listeners are only
     * attached on the first registration.
     *
     * @param callback - Function to call when screenshot is detected
     */
    public register(callback: ScreenshotDetectedCallback): void {
        this.listenerCount++;
        this.callback = callback;

        if (!this.isListenerRegistered) {
            this.attachListeners();
        }
    }

    /**
     * Decrements the registration count. When count reaches zero,
     * all event listeners are removed and state is reset.
     */
    public unregister(): void {
        this.listenerCount = Math.max(0, this.listenerCount - 1);

        if (this.listenerCount === 0) {
            this.detachListeners();
        }
    }

    /**
     * Returns the current number of active registrations.
     * Useful for debugging and testing.
     */
    public getRegistrationCount(): number {
        return this.listenerCount;
    }

    /**
     * Attaches all event listeners for screenshot detection and blur protection.
     */
    private attachListeners(): void {
        if (this.isListenerRegistered) {
            return;
        }

        const {isMac, isWindows, isLinux} = detectPlatform();

        this.keydownHandler = (e: KeyboardEvent) => {
            this.handleKeyDown(e, isMac, isWindows, isLinux);
        };

        this.keyupHandler = (e: KeyboardEvent) => {
            this.handleKeyUp(e, isMac, isWindows);
        };

        this.blurHandler = () => {
            this.handleWindowBlur();
        };

        this.focusHandler = () => {
            this.handleWindowFocus();
        };

        this.visibilityChangeHandler = () => {
            this.handleVisibilityChange();
        };

        // Use capture phase to intercept events before they reach other handlers
        window.addEventListener('keydown', this.keydownHandler, true);
        window.addEventListener('keyup', this.keyupHandler, true);
        window.addEventListener('blur', this.blurHandler, true);
        window.addEventListener('focus', this.focusHandler, true);
        document.addEventListener('visibilitychange', this.visibilityChangeHandler, true);

        this.isListenerRegistered = true;
    }

    /**
     * Removes all event listeners and resets internal state.
     */
    private detachListeners(): void {
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler, true);
            this.keydownHandler = null;
        }
        if (this.keyupHandler) {
            window.removeEventListener('keyup', this.keyupHandler, true);
            this.keyupHandler = null;
        }
        if (this.blurHandler) {
            window.removeEventListener('blur', this.blurHandler, true);
            this.blurHandler = null;
        }
        if (this.focusHandler) {
            window.removeEventListener('focus', this.focusHandler, true);
            this.focusHandler = null;
        }
        if (this.visibilityChangeHandler) {
            document.removeEventListener('visibilitychange', this.visibilityChangeHandler, true);
            this.visibilityChangeHandler = null;
        }

        // Clean up blur class if still applied
        document.body.classList.remove(BLUR_CLASS);

        this.clearWarningTimeout();
        this.resetState();
    }

    /**
     * Handles keydown events for screenshot shortcut detection.
     */
    private handleKeyDown(e: KeyboardEvent, isMac: boolean, isWindows: boolean, isLinux: boolean): void {
        // Handle PrintScreen on Windows/Linux
        if ((isWindows || isLinux) && (e.key === 'PrintScreen' || e.code === 'PrintScreen')) {
            this.triggerCallbackThrottled();
            return;
        }

        // Handle Mac: Cmd+Shift combinations
        if (isMac) {
            this.handleMacScreenshotDetection(e);
        }

        // Handle Windows: Windows+Shift+S (Snipping Tool)
        if (isWindows) {
            this.handleWindowsScreenshotDetection(e);
        }
    }

    /**
     * Detects Cmd+Shift screenshot shortcuts on macOS.
     * Starts a timer when Cmd+Shift is pressed; if no other key is pressed
     * within the delay, assumes it's a screenshot attempt.
     */
    private handleMacScreenshotDetection(e: KeyboardEvent): void {
        const wasModifiersPressed = this.cmdKeyPressed && this.shiftKeyPressed;

        this.cmdKeyPressed = e.metaKey;
        this.shiftKeyPressed = e.shiftKey;

        const modifiersNowPressed = this.cmdKeyPressed && this.shiftKeyPressed;

        // Modifiers just became pressed together - start detection timer
        if (modifiersNowPressed && !wasModifiersPressed) {
            this.otherKeyPressed = false;
            this.startScreenshotDetectionTimer();
        }

        // Another key pressed while modifiers held - it's a regular shortcut, cancel detection
        if (modifiersNowPressed && !this.isModifierKey(e.key)) {
            this.otherKeyPressed = true;
            this.clearWarningTimeout();
        }
    }

    /**
     * Detects Windows+Shift+S (Snipping Tool) on Windows.
     * Similar logic to Mac, but also triggers immediately on 'S' key.
     */
    private handleWindowsScreenshotDetection(e: KeyboardEvent): void {
        const wasModifiersPressed = this.cmdKeyPressed && this.shiftKeyPressed;

        this.cmdKeyPressed = e.metaKey; // Windows key
        this.shiftKeyPressed = e.shiftKey;

        const modifiersNowPressed = this.cmdKeyPressed && this.shiftKeyPressed;

        // Modifiers just became pressed together - start detection timer
        if (modifiersNowPressed && !wasModifiersPressed) {
            this.otherKeyPressed = false;
            this.startScreenshotDetectionTimer();
        }

        // Windows+Shift+S pressed - trigger immediately
        if (modifiersNowPressed && e.key.toLowerCase() === 's') {
            this.clearWarningTimeout();
            this.triggerCallbackThrottled();
            return;
        }

        // Another key (not 'S') pressed - it's a regular shortcut, cancel detection
        if (modifiersNowPressed && !this.isModifierKey(e.key) && e.key.toLowerCase() !== 's') {
            this.otherKeyPressed = true;
            this.clearWarningTimeout();
        }
    }

    /**
     * Handles keyup events to track modifier key state.
     */
    private handleKeyUp(e: KeyboardEvent, isMac: boolean, isWindows: boolean): void {
        if (isMac || isWindows) {
            this.cmdKeyPressed = e.metaKey;
            this.shiftKeyPressed = e.shiftKey;

            // If modifiers released, cancel any pending detection
            if (!this.cmdKeyPressed || !this.shiftKeyPressed) {
                this.clearWarningTimeout();
            }
        }
    }

    /**
     * Handles window blur by applying blur class after a short delay.
     * The delay allows focus to settle and prevents false positives
     * from clicks within the document.
     */
    private handleWindowBlur(): void {
        setTimeout(() => {
            if (!document.hasFocus()) {
                document.body.classList.add(BLUR_CLASS);
            }
        }, BLUR_SETTLE_DELAY_MS);

        // Reset keyboard state when window loses focus
        this.cmdKeyPressed = false;
        this.shiftKeyPressed = false;
        this.clearWarningTimeout();
    }

    /**
     * Handles window focus by removing the blur class.
     */
    private handleWindowFocus(): void {
        document.body.classList.remove(BLUR_CLASS);
    }

    /**
     * Handles page visibility changes (tab switching, minimizing).
     */
    private handleVisibilityChange(): void {
        if (document.hidden) {
            document.body.classList.add(BLUR_CLASS);
        } else if (document.hasFocus()) {
            document.body.classList.remove(BLUR_CLASS);
        }
    }

    /**
     * Starts a timer that will trigger the callback if no other key is pressed.
     */
    private startScreenshotDetectionTimer(): void {
        this.clearWarningTimeout();

        this.warningTimeout = setTimeout(() => {
            if (this.cmdKeyPressed && this.shiftKeyPressed && !this.otherKeyPressed) {
                this.triggerCallbackThrottled();
            }
        }, SCREENSHOT_DETECTION_DELAY_MS);
    }

    /**
     * Triggers the callback with throttling to prevent spam.
     */
    private triggerCallbackThrottled(): void {
        const now = Date.now();
        if (now - this.lastCallbackTime > CALLBACK_THROTTLE_MS) {
            this.lastCallbackTime = now;
            this.callback?.();
        }
    }

    /**
     * Clears the warning timeout if one is pending.
     */
    private clearWarningTimeout(): void {
        if (this.warningTimeout) {
            clearTimeout(this.warningTimeout);
            this.warningTimeout = null;
        }
    }

    /**
     * Checks if the given key is a modifier key.
     */
    private isModifierKey(key: string): boolean {
        return key === 'Meta' || key === 'Shift' || key === 'Control' || key === 'Alt';
    }

    /**
     * Resets all internal state to initial values.
     */
    private resetState(): void {
        this.isListenerRegistered = false;
        this.callback = null;
        this.cmdKeyPressed = false;
        this.shiftKeyPressed = false;
        this.otherKeyPressed = false;
        this.lastCallbackTime = 0;
    }
}

/** Singleton instance for global screenshot detection management */
export const screenshotDetectionManager = new ScreenshotDetectionManager();
