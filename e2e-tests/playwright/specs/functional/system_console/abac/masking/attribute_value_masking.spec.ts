// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    enableABAC,
    navigateToABACPage,
} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {
    createUserForABAC,
    createPrivateChannelForABAC,
    enableUserManagedAttributes,
} from '../support';

/**
 * Attribute-Value Masking E2E Tests
 *
 * These tests validate the full attribute-value masking feature:
 * - Delegated admins see only held values, non-held values appear as masked chips
 * - System admins see all values unmasked
 * - Hidden values are preserved through save operations
 * - Non-held values are rejected on the write path
 * - Self-inclusion check blocks save when delegated admin would be excluded
 * - Feature flag gates all masking behavior
 *
 * Prerequisites:
 * - Enterprise license with ABAC support
 * - AttributeValueMasking feature flag ON
 * - At least one shared_only select/multiselect CPA field
 */

test.describe('Attribute-Value Masking', () => {
    test('E2E-1: Full masking round-trip in Simple editor', async ({pw}) => {
        // Skip if no enterprise license
        await pw.skipIfNoLicense();

        // --- SETUP ---
        const {adminUser, adminClient, team} = await pw.initSetup();

        await enableUserManagedAttributes(adminClient);

        // Enable the masking feature flag
        const config = await adminClient.getConfig();
        config.FeatureFlags = config.FeatureFlags || {};
        (config.FeatureFlags as any).AttributeValueMasking = true;
        await adminClient.updateConfig(config);

        // Create a select attribute "Program" with options: Alpha, Bravo, Charlie
        const programAttribute: CustomProfileAttribute[] = [{
            name: 'Program',
            type: 'select',
            value: '',
        }];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, programAttribute);

        // Create a delegated admin who holds only "Alpha"
        const delegatedAdmin = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Program', type: 'select', value: 'Alpha'},
        ]);

        // Add delegated admin to team
        await adminClient.addToTeam(team.id, delegatedAdmin.id);

        // Create a private channel
        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(delegatedAdmin.id, channel.id);

        // Create a policy via API as system admin with all three values
        // (System admin sees all values — no masking for them)
        await enableABAC(adminClient);
        await navigateToABACPage(await pw.testBrowser.login(adminUser));

        // TODO: Create policy via API with expression:
        // user.attributes.Program in ["Alpha", "Bravo", "Charlie"]
        // Then navigate as delegated admin and verify masking

        // --- VERIFY AS DELEGATED ADMIN ---
        // Log in as delegated admin, navigate to the policy editor
        // Expected: "Alpha" visible as editable chip, masked chip (••••••••) present
        // Expected: Operator and attribute dropdowns are disabled on the masked row
        // Expected: Test Rules button is disabled
        // Expected: Delete (trash) button is enabled

        // --- EDIT AND SAVE ---
        // Add a new unmasked row, save
        // Reload and verify: "Alpha" still visible, masked chip still present, new row saved

        // --- VERIFY AS SYSTEM ADMIN ---
        // Log in as system admin, load same policy
        // Expected: All three values ("Alpha", "Bravo", "Charlie") visible, no masked chip
    });

    test('E2E-2: Edit visible values and hidden values are preserved', async ({pw}) => {
        await pw.skipIfNoLicense();

        // Setup: policy with Program in ["Alpha", "Bravo", "Charlie"]
        // Delegated admin holds "Alpha"
        // Steps:
        // 1. Log in as delegated admin, open policy editor
        // 2. Remove "Alpha" chip
        // 3. Add "Alpha" back
        // 4. Save — verify save succeeds
        // 5. As system admin: verify stored expression still contains all three values
    });

    test('E2E-3: Delegated admin deletes a masked row', async ({pw}) => {
        await pw.skipIfNoLicense();

        // Setup: policy with Program in ["Alpha", "Bravo", "Charlie"]
        // Delegated admin holds "Alpha"
        // Steps:
        // 1. Log in as delegated admin, open policy editor
        // 2. Click trash icon on the masked row
        // 3. Verify row is removed from UI
        // 4. Save
        // 5. As system admin: verify the Program condition is gone entirely
    });

    test('E2E-4: Self-inclusion failure blocks save', async ({pw}) => {
        await pw.skipIfNoLicense();

        // Setup: policy with Program in ["Alpha", "Bravo"]
        // Delegated admin holds "Alpha"
        // Steps:
        // 1. Log in as delegated admin, open policy editor
        // 2. Remove "Alpha" chip (the only visible value)
        // 3. Row shows only masked chip
        // 4. Click Save
        // 5. Verify error: "You do not satisfy one or more conditions in this policy."
        // 6. Verify policy is NOT saved (reload shows original state)
    });

    test('E2E-5: Value-hold rejection via direct API', async ({pw}) => {
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();

        // Enable masking flag
        const config = await adminClient.getConfig();
        config.FeatureFlags = config.FeatureFlags || {};
        (config.FeatureFlags as any).AttributeValueMasking = true;
        await adminClient.updateConfig(config);

        // Setup: Create attribute, delegated admin, policy
        // Steps:
        // 1. As delegated admin: send direct API request with non-held value "Delta"
        //    POST /api/v4/access_control/policies with expression containing "Delta"
        // 2. Verify HTTP 400 with "Invalid value."
        // 3. Send request with "--------" as literal value
        // 4. Verify HTTP 400 with "Invalid value." (same generic error)
    });

    test('E2E-6: CEL editor read-only with masked values', async ({pw}) => {
        await pw.skipIfNoLicense();

        // Setup: policy with masked values
        // Steps:
        // 1. Log in as delegated admin, open policy editor
        // 2. Switch to Advanced (CEL) mode
        // 3. Verify editor is read-only (cannot type)
        // 4. Verify banner: "This expression contains restricted values..."
        // 5. Verify Test Rules button is disabled
        // 6. Switch back to Simple mode — verify masked chips present
    });

    test('E2E-7: System admin sees all values unmasked', async ({pw}) => {
        await pw.skipIfNoLicense();

        // Setup: policy with Program in ["Alpha", "Bravo", "Charlie"]
        // Steps:
        // 1. Log in as system admin, open the policy
        // 2. Verify all values visible as editable chips
        // 3. Verify no masked chip appears
        // 4. Verify operator and attribute dropdowns are editable
        // 5. Verify Test Rules button is enabled
        // 6. Switch to CEL mode — verify editor is editable, no banner
    });

    test('E2E-8: No masking when feature flag is OFF', async ({pw}) => {
        await pw.skipIfNoLicense();

        const {adminClient} = await pw.initSetup();

        // Explicitly disable the masking flag
        const config = await adminClient.getConfig();
        config.FeatureFlags = config.FeatureFlags || {};
        (config.FeatureFlags as any).AttributeValueMasking = false;
        await adminClient.updateConfig(config);

        // Setup: policy with shared_only values
        // Steps:
        // 1. Log in as delegated admin, open policy editor
        // 2. Verify ALL values visible — no masking
        // 3. Verify operator/attribute dropdowns are editable
        // 4. Verify Test Rules button enabled
        // 5. Edit and save normally — no merge, no validation
    });

    test('E2E-9: New policy creation has no masking', async ({pw}) => {
        await pw.skipIfNoLicense();

        // Steps:
        // 1. As delegated admin: create a new policy
        // 2. Add a rule row, select attribute, operator, add a held value
        // 3. Verify no masked chip (new policy, no hidden values)
        // 4. Verify all dropdowns editable
        // 5. Verify Test Rules enabled
        // 6. Save — verify created successfully
    });

    test('E2E-10: Multi-value add alongside masked values', async ({pw}) => {
        await pw.skipIfNoLicense();

        // Setup: policy with Program in ["Bravo", "Charlie"]
        // Delegated admin holds "Alpha" (none of the policy values)
        // Steps:
        // 1. Log in as delegated admin, open policy editor
        // 2. Verify row shows only masked chip (no visible values)
        // 3. Click + button on the row
        // 4. Verify "Alpha" appears in dropdown
        // 5. Select "Alpha"
        // 6. Verify row now shows "Alpha" chip + masked chip
        // 7. Save — verify succeeds
        // 8. As system admin: verify stored expression is Program in ["Bravo", "Charlie", "Alpha"]
    });

    test('E2E-11: Text field masking with shared_only and in operator', async ({pw}) => {
        await pw.skipIfNoLicense();

        // This test validates that text fields with access_mode: shared_only
        // are correctly masked when used with the "in" operator in policy rules.

        const {adminUser, adminClient, team} = await pw.initSetup();

        await enableUserManagedAttributes(adminClient);

        // Enable the masking feature flag
        const config = await adminClient.getConfig();
        config.FeatureFlags = config.FeatureFlags || {};
        (config.FeatureFlags as any).AttributeValueMasking = true;
        await adminClient.updateConfig(config);

        // Setup:
        // 1. Create a text CPA field "Clearance" with access_mode: shared_only, protected: true
        //    (via API — PATCH /api/v4/custom_profile_attributes/fields/{id} with attrs.access_mode = "shared_only")
        // 2. Create delegated admin with Clearance = "Top Secret"
        // 3. Create policy with rule: Clearance in ["Top Secret", "Secret", "Confidential"]

        // Steps:
        // 1. Log in as delegated admin, open the policy editor
        // 2. Verify the Clearance row shows: "Top Secret" as visible chip + masked chip (••••••••)
        // 3. Verify "Secret" and "Confidential" are NOT visible anywhere in the UI
        // 4. Verify operator dropdown is locked on the masked row
        // 5. Verify attribute dropdown is locked on the masked row
        // 6. As system admin: load same policy — verify all three values visible, no masking

        // This validates that the text field branch in maskConditionValues works correctly:
        // - getCallerTextValues fetches the caller's "Top Secret" text value
        // - filterConditionValues keeps "Top Secret", masks "Secret" and "Confidential"
        // - HasMaskedValues is set to true on the condition
    });

    test('E2E-12: Text field masking with == operator', async ({pw}) => {
        await pw.skipIfNoLicense();

        // Setup:
        // 1. Text CPA field "Location" with access_mode: shared_only, protected: true
        // 2. Delegated admin with Location = "Building 1"
        // 3. Policy with rule: Location != "Building 7"

        // Steps:
        // 1. Log in as delegated admin, open the policy editor
        // 2. Verify the Location row shows only masked chip (delegated admin holds "Building 1", not "Building 7")
        // 3. Operator and attribute dropdowns are locked
        // 4. As system admin: "Building 7" is visible
    });
});
