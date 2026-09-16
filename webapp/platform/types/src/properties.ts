// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IDMappedObjects} from './utilities';

export type FieldType = (
    'text' |
    'select' |
    'multiselect' |
    'date' |
    'user' |
    'multiuser' |
    'rank'
);

export type FieldVisibility = 'always' | 'hidden' | 'when_set';
export type FieldValueType =
    'email' |
    'url' |
    'phone' |
    '';

// Mirrors model/property_field.go. Empty means the server fills in the default
// for the field's object type.
export type PropertyPermissionLevel = 'none' | 'sysadmin' | 'admin' | 'member' | '';

export type PropertyField = {
    id: string;
    group_id: string;
    name: string;
    type: FieldType;
    attrs?: {
        subType?: string;
        [key: string]: unknown;
    };
    target_id: string;
    target_type: string;
    object_type: string;
    linked_field_id?: string;
    protected?: boolean;

    // The server is authoritative on all three; the client reads permission_values
    // only to decide whether to offer an editing affordance.
    permission_field?: PropertyPermissionLevel;
    permission_values?: PropertyPermissionLevel;
    permission_options?: PropertyPermissionLevel;
    create_at: number;
    update_at: number;
    delete_at: number;
    created_by: string;
    updated_by: string;
};

export type PropertyGroup = {
    id: string;
    name: string;
};

export type NameMappedPropertyFields = {[key: PropertyField['name']]: PropertyField};

export type PropertyValue<T> = {
    id: string;
    target_id: string;
    target_type: string;
    group_id: string;
    field_id: string;
    value: T;
    create_at: number;
    update_at: number;
    delete_at: number;
    created_by: string;
    updated_by: string;
};

/**
 * Base shape for a select/multiselect option. Features that constrain or
 * extend an option define their own type by aliasing this one.
 */
export type PropertyFieldOption = {
    id: string;
    name: string;
    color?: string;

    // Optional explicit ordering. When unset, consumers fall back to the
    // position of the option within `attrs.options`.
    rank?: number;
};

export type SelectPropertyField = PropertyField & {
    attrs?: {
        editable?: boolean;
        options?: PropertyFieldOption[];
    };
};

export const supportsOptions = (field: PropertyField) => {
    return field.type === 'select' || field.type === 'multiselect' || field.type === 'rank';
};

export const isTextField = (field: PropertyField) => {
    return field.type === 'text';
};

// How a value may move once it is set, mirroring attrs.change_policy in
// model/property_field_attrs_validation.go. raise_only and lower_only compare
// option ranks, so the server strips them from any field that is not a rank.
export const PROPERTY_CHANGE_POLICIES = ['any', 'raise_only', 'lower_only', 'never'] as const;

export type PropertyChangePolicy = typeof PROPERTY_CHANGE_POLICIES[number];

export const ORDERED_PROPERTY_CHANGE_POLICIES: PropertyChangePolicy[] = ['raise_only', 'lower_only'];

export function isOrderedChangePolicy(policy: PropertyChangePolicy): boolean {
    return ORDERED_PROPERTY_CHANGE_POLICIES.includes(policy);
}

// PSA v2 state types

export type PropertiesState = {
    fields: PropertyFieldsState;
    values: PropertyValuesState;
    groups: PropertyGroupsState;
};

export type PropertyFieldsState = {
    byObjectType: {
        [objectType: string]: {
            [groupId: string]: IDMappedObjects<PropertyField>;
        };
    };
    byId: IDMappedObjects<PropertyField>;
};

export type PropertyValuesState = {
    byTargetId: {
        [targetId: string]: {
            [fieldId: string]: PropertyValue<unknown>;
        };
    };
    byFieldId: {
        [fieldId: string]: {
            [targetId: string]: PropertyValue<unknown>;
        };
    };
};

export type PropertyGroupsState = {
    byId: IDMappedObjects<PropertyGroup>;
    byName: {[name: string]: PropertyGroup};
};

export type PropertyValuesUpdated<T> = {
    object_type?: string;
    target_id?: string;
    field_id?: string;
    values: Array<PropertyValue<T>>;
};

// Required-channel-attribute compliance (MM-70717). Mirrors
// model/channel_attribute_compliance.go.

export type ChannelAttributeAdmin = {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    nickname: string;
};

export type ChannelMissingAttributeValue = {
    channel_id: string;
    channel_name: string;
    channel_display_name: string;
    channel_type: string;
    team_id: string;
    team_display_name: string;

    // False for shared/remote channels. Those are informational only -- they
    // are excluded from the required-attribute gate and count.
    is_local: boolean;

    // Empty when the channel has no channel admin to notify.
    channel_admins: ChannelAttributeAdmin[];
};

export type ChannelsMissingAttributeValueList = {
    channels: ChannelMissingAttributeValue[];
    total_count: number;
};

// The count-only view behind the Required toggle's banner. field_id is
// omitted in create mode, before the attribute has been saved.
export type ChannelAttributeComplianceSummary = {
    field_id?: string;
    required: boolean;
    missing_channel_count: number;
    shared_channel_count: number;
    unique_admin_count: number;
    channels_without_admin_count: number;
    message_preview: string;
};

export type ChannelAttributeNotifyResult = {
    notified_admin_count: number;
    notified_channel_count: number;
    channels_without_admin_count: number;

    // True when the server's (admin, channel) assignment scan hit its batch
    // cap -- some admins may not have been notified about every one of their
    // affected channels.
    truncated: boolean;
};
