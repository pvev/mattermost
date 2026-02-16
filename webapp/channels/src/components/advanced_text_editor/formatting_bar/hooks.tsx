// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Instance} from '@popperjs/core';
import debounce from 'lodash/debounce';
import type React from 'react';
import {useEffect, useLayoutEffect, useMemo, useState} from 'react';

import type {MarkdownMode} from 'utils/markdown/apply_markdown';

type WideMode = 'wide' | 'normal' | 'narrow' | 'min';

// Debounce delay for ResizeObserver - balances responsiveness with performance
const RESIZE_DEBOUNCE_MS = 10;

const useResponsiveFormattingBar = (ref: React.RefObject<HTMLDivElement>): WideMode => {
    const [wideMode, setWideMode] = useState<WideMode>('wide');
    const handleResize = useMemo(() => debounce(() => {
        if (ref.current?.clientWidth == null) {
            return;
        }

        // Breakpoints account for space needed by send button (~100px)
        if (ref.current.clientWidth > 750) {
            setWideMode('wide');
        }
        if (ref.current.clientWidth >= 580 && ref.current.clientWidth <= 750) {
            setWideMode('normal');
        }
        if (ref.current.clientWidth >= 420 && ref.current.clientWidth < 580) {
            setWideMode('narrow');
        }

        if (ref.current.clientWidth < 420) {
            setWideMode('min');
        }
    }, RESIZE_DEBOUNCE_MS), [ref]);

    useLayoutEffect(() => {
        if (!ref.current) {
            return () => {};
        }

        let sizeObserver: ResizeObserver | null = new ResizeObserver(handleResize);

        sizeObserver.observe(ref.current);

        return () => {
            if (sizeObserver) {
                sizeObserver.disconnect();
                sizeObserver = null;
            }
        };
    }, [handleResize, ref]);

    return wideMode;
};

// Formatting controls organized by section for proper separator placement
// Section 1: bold, italic, strike, heading
// Section 2: link, code
// Section 3: quote, ul, ol
const SECTION_1_CONTROLS: MarkdownMode[] = ['bold', 'italic', 'strike', 'heading'];
const SECTION_2_CONTROLS: MarkdownMode[] = ['link', 'code'];
const SECTION_3_CONTROLS: MarkdownMode[] = ['quote', 'ul', 'ol'];

/**
 * Split formatting controls based on available width
 * @param wideMode - Current width mode (wide/normal/narrow/min)
 * @returns Object with visible controls, hidden controls, and section separators
 */
export function splitFormattingBarControls(wideMode: WideMode) {
    const allControls: MarkdownMode[] = [...SECTION_1_CONTROLS, ...SECTION_2_CONTROLS, ...SECTION_3_CONTROLS];

    let visibleControls: MarkdownMode[] = [];
    const separatorAfter: Set<MarkdownMode> = new Set();

    if (wideMode === 'wide') {
        // Wide mode: Show all 9 icons in 3 sections
        // [B, I, S, H] | [Link, Code] | [Quote, UL, OL]
        visibleControls = allControls;
        separatorAfter.add('heading'); // After section 1
        separatorAfter.add('code'); // After section 2
        separatorAfter.add('ol'); // After section 3 (before additional controls)
    } else if (wideMode === 'normal') {
        // Normal mode: Show 6 icons in 1 section
        // [B, I, S, H, Link, Code] | (hidden: Quote, UL, OL)
        visibleControls = [...SECTION_1_CONTROLS, ...SECTION_2_CONTROLS];
        separatorAfter.add('code'); // After all visible controls (before additional controls)
    } else if (wideMode === 'narrow') {
        // Narrow mode: Show 3 icons
        // [B, I, S] | (hidden: H, Link, Code, Quote, UL, OL)
        visibleControls = SECTION_1_CONTROLS.slice(0, 3);
        separatorAfter.add('strike'); // After all visible controls (before additional controls)
    } else {
        // Min mode: Show 0 icons
        // (hidden: all)
        visibleControls = [];
    }

    const hiddenControls = allControls.filter((control) => !visibleControls.includes(control));

    return {
        controls: visibleControls,
        hiddenControls,
        separatorAfter,
    };
}

export const useFormattingBarControls = (
    formattingBarRef: React.RefObject<HTMLDivElement>,
): {
    controls: MarkdownMode[];
    hiddenControls: MarkdownMode[];
    separatorAfter: Set<MarkdownMode>;
    wideMode: WideMode;
} => {
    const wideMode = useResponsiveFormattingBar(formattingBarRef);

    const {controls, hiddenControls, separatorAfter} = splitFormattingBarControls(wideMode);

    return {
        controls,
        hiddenControls,
        separatorAfter,
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
