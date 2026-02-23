// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Instance} from '@popperjs/core';
import debounce from 'lodash/debounce';
import type React from 'react';
import {useEffect, useLayoutEffect, useMemo, useState} from 'react';

import type {MarkdownMode} from 'utils/markdown/apply_markdown';

type WideMode = 'wide' | 'normal' | 'narrow' | 'min';

// Breakpoint configurations for different locations
const BREAKPOINTS_CENTER = {
    wide: 640,
    normal: 424,
    narrow: 310,
    min: 0,
} as const;

const BREAKPOINTS_RHS = {
    wide: 520,
    normal: 380,
    narrow: 300,
    min: 280,
} as const;

const DEBOUNCE_DELAY = 10;

const useResponsiveFormattingBar = (ref: React.RefObject<HTMLDivElement>, location: string = ''): WideMode => {
    const [wideMode, setWideMode] = useState<WideMode>('wide');

    // Determine location type once
    const isRHS = useMemo(() => location.toLowerCase().includes('rhs'), [location]);

    // Select appropriate breakpoints based on location
    const breakpoints = useMemo(() => {
        return isRHS ? BREAKPOINTS_RHS : BREAKPOINTS_CENTER;
    }, [isRHS]);

    const handleResize = useMemo(() => debounce(() => {
        if (ref.current?.clientWidth == null) {
            return;
        }

        const width = ref.current.clientWidth;

        // Determine wide mode based on width and breakpoints
        if (width > breakpoints.wide) {
            setWideMode('wide');
        } else if (width >= breakpoints.normal) {
            setWideMode('normal');
        } else if (isRHS && width >= breakpoints.min) {
            // RHS uses min breakpoint to stay in narrow mode longer
            setWideMode('narrow');
        } else if (!isRHS && width >= breakpoints.narrow) {
            // Center uses narrow breakpoint
            setWideMode('narrow');
        } else {
            setWideMode('min');
        }
    }, DEBOUNCE_DELAY), [ref, isRHS, breakpoints]);

    useLayoutEffect(() => {
        if (!ref.current) {
            return () => {};
        }

        const sizeObserver = new ResizeObserver(handleResize);
        sizeObserver.observe(ref.current);

        return () => {
            sizeObserver.disconnect();
        };
    }, [handleResize, ref]);

    return wideMode;
};

// Base icon counts for each mode (no additional controls)
const CONTROLS_COUNT_BASE: Record<WideMode, number> = {
    wide: 9,
    normal: 5,
    narrow: 3,
    min: 1,
};

// Reduced icon counts when additional controls are present (to prevent overlap)
// Both center and RHS use same reduction pattern: 7→3→1→0
const CONTROLS_COUNT_WITH_ADDITIONAL: Record<WideMode, number> = {
    wide: 7,
    normal: 3,
    narrow: 1,
    min: 0,
};

// Minimum number of additional controls needed to trigger reduction in narrow mode for center channel
const NARROW_MODE_MIN_ADDITIONAL_CONTROLS = 2;

// All available formatting controls in priority order
const ALL_CONTROLS: MarkdownMode[] = ['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol'];

export function splitFormattingBarControls(wideMode: WideMode, additionalControlsCount: number = 0, isRHS: boolean = false) {
    let visibleControlsCount = CONTROLS_COUNT_BASE[wideMode];

    if (additionalControlsCount > 0) {
        if (isRHS) {
            // RHS: Always apply reduction when additional controls present
            visibleControlsCount = CONTROLS_COUNT_WITH_ADDITIONAL[wideMode];
        } else if (wideMode === 'narrow' && additionalControlsCount < NARROW_MODE_MIN_ADDITIONAL_CONTROLS) {
            // Center: Only reduce in narrow mode if we have 2+ additional controls
            visibleControlsCount = CONTROLS_COUNT_BASE.narrow;
        } else {
            // Center: Apply reduction for all other cases
            visibleControlsCount = CONTROLS_COUNT_WITH_ADDITIONAL[wideMode];
        }
    }

    const controls = ALL_CONTROLS.slice(0, visibleControlsCount);
    const hiddenControls = ALL_CONTROLS.slice(visibleControlsCount);

    return {
        controls,
        hiddenControls,
    };
}

export const useFormattingBarControls = (
    formattingBarRef: React.RefObject<HTMLDivElement>,
    additionalControlsCount: number = 0,
    location: string = '',
): {
    controls: MarkdownMode[];
    hiddenControls: MarkdownMode[];
    wideMode: WideMode;
} => {
    const wideMode = useResponsiveFormattingBar(formattingBarRef, location);

    // Memoize isRHS computation to avoid recalculating on every render
    const isRHS = useMemo(() => location.toLowerCase().includes('rhs'), [location]);

    // Memoize controls split to avoid unnecessary recalculations
    const {controls, hiddenControls} = useMemo(() => {
        return splitFormattingBarControls(wideMode, additionalControlsCount, isRHS);
    }, [wideMode, additionalControlsCount, isRHS]);

    return {
        controls,
        hiddenControls,
        wideMode,
    };
};

export const useUpdateOnVisibilityChange = (update: Instance['update'] | null, isVisible: boolean) => {
    const updateComponent = async () => {
        if (!update) {
            return;
        }
        await update();
    };

    useEffect(() => {
        if (!isVisible) {
            return;
        }
        updateComponent();
    }, [isVisible]);
};
