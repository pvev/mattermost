// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {splitFormattingBarControls} from './hooks';

describe('splitFormattingBarControls', () => {
    describe('wide mode', () => {
        test('shows all 9 controls in 3 sections', () => {
            const {controls, hiddenControls, separatorAfter} = splitFormattingBarControls('wide');
            expect(controls).toHaveLength(9);
            expect(hiddenControls).toHaveLength(0);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol']);

            // Should have separators after 'heading', 'code', and 'ol'
            expect(separatorAfter.has('heading')).toBe(true);
            expect(separatorAfter.has('code')).toBe(true);
            expect(separatorAfter.has('ol')).toBe(true);
            expect(separatorAfter.size).toBe(3);
        });
    });

    describe('normal mode', () => {
        test('shows 6 controls in 1 section', () => {
            const {controls, hiddenControls, separatorAfter} = splitFormattingBarControls('normal');
            expect(controls).toHaveLength(6);
            expect(hiddenControls).toHaveLength(3);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link', 'code']);
            expect(hiddenControls).toEqual(['quote', 'ul', 'ol']);

            // Should have separator after 'code'
            expect(separatorAfter.has('code')).toBe(true);
            expect(separatorAfter.size).toBe(1);
        });
    });

    describe('narrow mode', () => {
        test('shows 3 controls', () => {
            const {controls, hiddenControls, separatorAfter} = splitFormattingBarControls('narrow');
            expect(controls).toHaveLength(3);
            expect(hiddenControls).toHaveLength(6);
            expect(controls).toEqual(['bold', 'italic', 'strike']);
            expect(hiddenControls).toEqual(['heading', 'link', 'code', 'quote', 'ul', 'ol']);

            // Should have separator after 'strike'
            expect(separatorAfter.has('strike')).toBe(true);
            expect(separatorAfter.size).toBe(1);
        });
    });

    describe('min mode', () => {
        test('hides all controls', () => {
            const {controls, hiddenControls, separatorAfter} = splitFormattingBarControls('min');
            expect(controls).toHaveLength(0);
            expect(hiddenControls).toHaveLength(9);
            expect(hiddenControls).toEqual(['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol']);
            expect(separatorAfter.size).toBe(0);
        });
    });

    describe('controls order', () => {
        test('controls are in priority order', () => {
            const {controls} = splitFormattingBarControls('wide');
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol']);
        });

        test('sections are properly separated', () => {
            const {controls, separatorAfter} = splitFormattingBarControls('wide');

            // Section 1: bold, italic, strike, heading
            expect(controls.slice(0, 4)).toEqual(['bold', 'italic', 'strike', 'heading']);
            expect(separatorAfter.has('heading')).toBe(true);

            // Section 2: link, code
            expect(controls.slice(4, 6)).toEqual(['link', 'code']);
            expect(separatorAfter.has('code')).toBe(true);

            // Section 3: quote, ul, ol
            expect(controls.slice(6, 9)).toEqual(['quote', 'ul', 'ol']);
        });
    });
});
