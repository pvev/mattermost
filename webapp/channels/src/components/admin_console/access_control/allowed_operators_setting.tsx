// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {defineMessage, useIntl} from 'react-intl';

import MultiSelectSetting from 'components/admin_console/multiselect_settings';

import './allowed_operators_setting.scss';

const ALL_OPERATORS = [
    {
        value: '==',
        label: defineMessage({id: 'admin.accesscontrol.operator.equals', defaultMessage: 'is (equals)'}),
    },
    {
        value: '!=',
        label: defineMessage({id: 'admin.accesscontrol.operator.not_equals', defaultMessage: 'is not (not equals)'}),
    },
    {
        value: 'in',
        label: defineMessage({id: 'admin.accesscontrol.operator.in', defaultMessage: 'in (list membership)'}),
    },
    {
        value: 'startsWith',
        label: defineMessage({id: 'admin.accesscontrol.operator.starts_with', defaultMessage: 'starts with'}),
    },
    {
        value: 'endsWith',
        label: defineMessage({id: 'admin.accesscontrol.operator.ends_with', defaultMessage: 'ends with'}),
    },
    {
        value: 'contains',
        label: defineMessage({id: 'admin.accesscontrol.operator.contains', defaultMessage: 'contains'}),
    },
];

interface Props {
    id: string;
    value: string[];
    onChange: (id: string, value: string[]) => void;
    disabled: boolean;
    setByEnv: boolean;
}

const AllowedOperatorsSetting: React.FC<Props> = ({
    id,
    value,
    onChange,
    disabled,
    setByEnv,
}) => {
    const {formatMessage} = useIntl();

    const options = useMemo(() => {
        return ALL_OPERATORS.map((op) => ({
            value: op.value,
            text: formatMessage(op.label),
        }));
    }, [formatMessage]);

    const selected = useMemo(() => {
        if (!value || !Array.isArray(value)) {
            return ALL_OPERATORS.map((op) => op.value);
        }
        return value;
    }, [value]);

    const handleChange = useCallback((settingId: string, values: string[]) => {
        onChange(settingId, values);
    }, [onChange]);

    return (
        <div className='AllowedOperatorsSetting'>
            <MultiSelectSetting
                id={id}
                values={options}
                label={formatMessage({
                    id: 'admin.accesscontrol.allowedOperators.title',
                    defaultMessage: 'Allowed operators for channel admins',
                })}
                helpText={formatMessage({
                    id: 'admin.accesscontrol.allowedOperators.desc',
                    defaultMessage: 'Select which operators channel and team admins are allowed to use when creating access rules. Removing substring operators (contains, starts with, ends with) reduces the risk of attribute value enumeration through the test feature.',
                })}
                selected={selected}
                onChange={handleChange}
                disabled={disabled}
                setByEnv={setByEnv}
                noOptionsMessage={formatMessage({
                    id: 'admin.accesscontrol.allowedOperators.noOptions',
                    defaultMessage: 'All operators have been selected',
                })}
            />
        </div>
    );
};

export default React.memo(AllowedOperatorsSetting);
