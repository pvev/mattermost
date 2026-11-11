// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The channel attributes form the conversion and unarchive dialogs ask required
 * values with. Locators key off the attribute's machine name.
 */
export default class RequiredAttributesForm {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    row(name: string): Locator {
        return this.container.getByTestId(`channelAttributeRow-${name}`);
    }

    field(name: string): Locator {
        return this.container.getByTestId(`channelAttribute-${name}`);
    }

    /**
     * Opens a select attribute and picks one of its options. The menu renders in
     * a portal outside the dialog, so the option is looked up on the page.
     */
    async select(name: string, option: string) {
        await this.field(name).click();
        await this.container.page().getByText(option, {exact: true}).click();
        await expect(this.field(name)).toContainText(option);
    }
}
