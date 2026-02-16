// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Instance} from '@popperjs/core';
import debounce from 'lodash/debounce';
import type React from 'react';
import {useEffect, useLayoutEffect, useMemo, useState} from 'react';

import type {MarkdownMode} from 'utils/markdown/apply_markdown';

type WideMode = 'wide' | 'normal' | 'narrow' | 'min';

const useResponsiveFormattingBar = (ref: React.RefObject<HTMLDivElement>): WideMode => {
    const [wideMode, setWideMode] = useState<WideMode>('wide');
    const handleResize = useMemo(() => debounce(() => {
        if (ref.current?.clientWidth == null) {
            return;
        }
        if (ref.current.clientWidth > 640) {
            setWideMode('wide');
        }
        if (ref.current.clientWidth >= 424 && ref.current.clientWidth <= 640) {
            setWideMode('normal');
        }
        if (ref.current.clientWidth < 424) {
            setWideMode('narrow');
        }

        if (ref.current.clientWidth < 310) {
            setWideMode('min');
        }
    }, 10), [ref]);

    useLayoutEffect(() => {
        if (!ref.current) {
            return () => {};
        }

        let sizeObserver: ResizeObserver | null = new ResizeObserver(handleResize);

        sizeObserver.observe(ref.current);

        return () => {
            sizeObserver!.disconnect();
            sizeObserver = null;
        };
    }, [handleResize, ref]);

    return wideMode;
};

const MAP_WIDE_MODE_TO_CONTROLS_QUANTITY: {[key in WideMode]: number} = {
    wide: 9,
    normal: 5,
    narrow: 3,
    min: 1,
};

// When additional controls (priority, AI, burn-on-read) are present,
// reduce base formatting icons to prevent overlap with actions bar
const MAP_WIDE_MODE_WITH_ADDITIONAL_CONTROLS: {[key in WideMode]: number} = {
    wide: 7,
    normal: 3,
    narrow: 1,
    min: 0,
};

const NARROW_MODE_MIN_ADDITIONAL_CONTROLS = 2;

export function splitFormattingBarControls(wideMode: WideMode, additionalControlsCount: number = 0) {
    const allControls: MarkdownMode[] = ['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol'];

    let visibleControlsCount = MAP_WIDE_MODE_TO_CONTROLS_QUANTITY[wideMode];

    if (additionalControlsCount > 0) {
        if (wideMode === 'narrow' && additionalControlsCount < NARROW_MODE_MIN_ADDITIONAL_CONTROLS) {
            visibleControlsCount = MAP_WIDE_MODE_TO_CONTROLS_QUANTITY.narrow;
        } else {
            visibleControlsCount = MAP_WIDE_MODE_WITH_ADDITIONAL_CONTROLS[wideMode];
        }
    }

    const controls = allControls.slice(0, visibleControlsCount);
    const hiddenControls = allControls.slice(visibleControlsCount);

    return {
        controls,
        hiddenControls,
    };
}

export const useFormattingBarControls = (
    formattingBarRef: React.RefObject<HTMLDivElement>,
    additionalControlsCount: number = 0,
): {
    controls: MarkdownMode[];
    hiddenControls: MarkdownMode[];
    wideMode: WideMode;
} => {
    const wideMode = useResponsiveFormattingBar(formattingBarRef);

    const {controls, hiddenControls} = splitFormattingBarControls(wideMode, additionalControlsCount);

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
