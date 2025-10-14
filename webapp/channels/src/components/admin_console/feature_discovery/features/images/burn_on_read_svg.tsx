// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type SvgProps = {
    width?: number;
    height?: number;
}

const BurnOnReadSVG = (props: SvgProps) => (
    <svg
        width={props.width ? props.width.toString() : '294'}
        height={props.height ? props.height.toString() : '180'}
        viewBox='0 0 196 120'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        {/* Message bubble */}
        <rect
            x='40'
            y='30'
            width='116'
            height='60'
            rx='8'
            fill='var(--center-channel-color)'
            fillOpacity='0.08'
        />
        <rect
            x='40'
            y='30'
            width='116'
            height='60'
            rx='8'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.24'
            strokeWidth='1'
        />
        
        {/* Flame/fire icon in center */}
        <path
            d='M98 45c-2 0-4 2-4 4.5 0 3 2 5.5 4 5.5s4-2.5 4-5.5c0-2.5-2-4.5-4-4.5z'
            fill='#FF8A00'
        />
        <path
            d='M98 55c-3 0-6 3-6 7 0 4.5 3 8 6 8s6-3.5 6-8c0-4-3-7-6-7z'
            fill='#FF4444'
        />
        
        {/* Timer/clock element */}
        <circle
            cx='98'
            cy='75'
            r='8'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeWidth='2'
            fill='none'
        />
        <path
            d='M98 70v5l3 3'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.64'
            strokeWidth='1.5'
            strokeLinecap='round'
        />
        
        {/* Sparkle/fade effects */}
        <circle
            cx='130'
            cy='40'
            r='2'
            fill='var(--center-channel-color)'
            fillOpacity='0.24'
        />
        <circle
            cx='140'
            cy='50'
            r='1.5'
            fill='var(--center-channel-color)'
            fillOpacity='0.32'
        />
        <circle
            cx='60'
            cy='45'
            r='1.5'
            fill='var(--center-channel-color)'
            fillOpacity='0.28'
        />
    </svg>
);

export default BurnOnReadSVG;
