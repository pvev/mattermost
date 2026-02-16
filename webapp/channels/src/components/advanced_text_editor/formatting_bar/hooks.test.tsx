// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {splitFormattingBarControls} from './hooks';

describe('splitFormattingBarControls', () => {
    describe('without additional controls', () => {
        test('wide mode shows all 9 controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('wide', 0);
            expect(controls).toHaveLength(9);
            expect(hiddenControls).toHaveLength(0);
        });

        test('normal mode shows 5 controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('normal', 0);
            expect(controls).toHaveLength(5);
            expect(hiddenControls).toHaveLength(4);
        });

        test('narrow mode shows 3 controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('narrow', 0);
            expect(controls).toHaveLength(3);
            expect(hiddenControls).toHaveLength(6);
        });

        test('min mode shows 1 control', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('min', 0);
            expect(controls).toHaveLength(1);
            expect(hiddenControls).toHaveLength(8);
        });
    });

    describe('with additional controls', () => {
        test('wide mode reduces to 7 controls with 1 additional control', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('wide', 1);
            expect(controls).toHaveLength(7);
            expect(hiddenControls).toHaveLength(2);
        });

        test('wide mode reduces to 7 controls with 2 additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('wide', 2);
            expect(controls).toHaveLength(7);
            expect(hiddenControls).toHaveLength(2);
        });

        test('normal mode reduces to 3 controls with 1 additional control', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('normal', 1);
            expect(controls).toHaveLength(3);
            expect(hiddenControls).toHaveLength(6);
        });

        test('narrow mode keeps 3 controls with 1 additional control', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('narrow', 1);
            expect(controls).toHaveLength(3);
            expect(hiddenControls).toHaveLength(6);
        });

        test('narrow mode reduces to 1 control with 2 additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('narrow', 2);
            expect(controls).toHaveLength(1);
            expect(hiddenControls).toHaveLength(8);
        });

        test('min mode hides all controls with additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('min', 1);
            expect(controls).toHaveLength(0);
            expect(hiddenControls).toHaveLength(9);
        });
    });

    describe('controls order', () => {
        test('controls are in priority order', () => {
            const {controls} = splitFormattingBarControls('normal', 0);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link']);
        });

        test('hidden controls are in correct order', () => {
            const {hiddenControls} = splitFormattingBarControls('normal', 0);
            expect(hiddenControls).toEqual(['code', 'quote', 'ul', 'ol']);
        });
    });
});
