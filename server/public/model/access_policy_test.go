// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAccessPolicyVersionV0_1(t *testing.T) {
	t.Run("invalid type", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       "policy_id",
			Type:     "invalid_type",
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for invalid type")
		require.Equal(t, "model.access_policy.is_valid.type.app_error", err.Id)
	})

	t.Run("invalid ID", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       "",
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for invalid ID")
		require.Equal(t, "model.access_policy.is_valid.id.app_error", err.Id)
	})

	t.Run("parent policy with empty name", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for empty name in parent policy")
		require.Equal(t, "model.access_policy.is_valid.name.app_error", err.Id)
	})

	t.Run("parent policy with too long name", func(t *testing.T) {
		var longName strings.Builder
		for i := 0; i <= MaxPolicyNameLength; i++ {
			longName.WriteString("a")
		}

		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     longName.String(),
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for too long name in parent policy")
		require.Equal(t, "model.access_policy.is_valid.name.app_error", err.Id)
	})

	t.Run("negative revision", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: -1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for negative revision")
		require.Equal(t, "model.access_policy.is_valid.revision.app_error", err.Id)
	})

	t.Run("invalid version", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: 1,
			Version:  "invalid-version",
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for invalid version")
		require.Equal(t, "model.access_policy.is_valid.version.app_error", err.Id)
	})

	t.Run("parent policy with no rules", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for parent policy with no rules")
		require.Equal(t, "model.access_policy.is_valid.rules.app_error", err.Id)
	})

	t.Run("parent policy with imports", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
			Imports:  []string{"some_import"},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for parent policy with imports")
		require.Equal(t, "model.access_policy.is_valid.imports.app_error", err.Id)
	})

	t.Run("channel policy with no rules", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{},
			Imports:  []string{"parent_policy_id"},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for channel policy with no rules")
		require.Equal(t, "model.access_policy.is_valid.rules.app_error", err.Id)
	})

	t.Run("channel policy with no imports", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
			Imports:  []string{},
		}

		err := policy.accessPolicyVersionV0_1()
		require.Nil(t, err, "Should not return error for channel policy with no imports")
	})

	t.Run("channel policy with multiple imports", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
			Imports:  []string{"parent_policy_id1", "parent_policy_id2"},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for channel policy with multiple imports")
		require.Equal(t, "model.access_policy.is_valid.imports.app_error", err.Id)
	})

	t.Run("valid parent policy", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: 1,
			Version:  "v0.1",
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.Nil(t, err, "Should not return error for valid parent policy")
	})

	t.Run("valid channel policy", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Name:     "Test Policy",
			Revision: 1,
			Version:  "v0.1",
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
			Imports:  []string{"parent_policy_id"},
		}

		err := policy.accessPolicyVersionV0_1()
		require.Nil(t, err, "Should not return error for valid channel policy")
	})
}

func TestDetectOperatorsInExpression(t *testing.T) {
	t.Run("empty expression", func(t *testing.T) {
		assert.Empty(t, DetectOperatorsInExpression(""))
		assert.Empty(t, DetectOperatorsInExpression("   "))
	})

	t.Run("equals operator", func(t *testing.T) {
		ops := DetectOperatorsInExpression(`user.attributes.Department == "Engineering"`)
		assert.True(t, ops[CELOperatorEquals])
		assert.False(t, ops[CELOperatorNotEquals])
	})

	t.Run("not equals operator", func(t *testing.T) {
		ops := DetectOperatorsInExpression(`user.attributes.Department != "Marketing"`)
		assert.True(t, ops[CELOperatorNotEquals])
		assert.False(t, ops[CELOperatorEquals], "!= should not trigger == detection")
	})

	t.Run("both == and != in same expression", func(t *testing.T) {
		ops := DetectOperatorsInExpression(`user.attributes.Dept == "Eng" && user.attributes.Level != "Junior"`)
		assert.True(t, ops[CELOperatorEquals])
		assert.True(t, ops[CELOperatorNotEquals])
	})

	t.Run("contains method", func(t *testing.T) {
		ops := DetectOperatorsInExpression(`user.attributes.Department.contains("Eng")`)
		assert.True(t, ops[CELOperatorContains])
	})

	t.Run("startsWith method", func(t *testing.T) {
		ops := DetectOperatorsInExpression(`user.attributes.Name.startsWith("A")`)
		assert.True(t, ops[CELOperatorStartsWith])
	})

	t.Run("endsWith method", func(t *testing.T) {
		ops := DetectOperatorsInExpression(`user.attributes.Email.endsWith("@example.com")`)
		assert.True(t, ops[CELOperatorEndsWith])
	})

	t.Run("in operator", func(t *testing.T) {
		ops := DetectOperatorsInExpression(`user.attributes.Department in ["Engineering", "Sales"]`)
		assert.True(t, ops[CELOperatorIn])
	})

	t.Run("in not triggered by substrings", func(t *testing.T) {
		ops := DetectOperatorsInExpression(`user.attributes.Origin == "international"`)
		assert.False(t, ops[CELOperatorIn], "'in' inside 'international' should not match")
	})

	t.Run("OR operator", func(t *testing.T) {
		ops := DetectOperatorsInExpression(`user.attributes.Dept == "Eng" || user.attributes.Dept == "Sales"`)
		assert.True(t, ops[CELOperatorOr])
		assert.True(t, ops[CELOperatorEquals])
	})

	t.Run("AND operator not tracked", func(t *testing.T) {
		ops := DetectOperatorsInExpression(`user.attributes.Dept == "Eng" && user.attributes.Level == "Senior"`)
		assert.False(t, ops["&&"], "&& is not tracked as a filterable operator")
	})

	t.Run("complex expression with multiple operators", func(t *testing.T) {
		expr := `user.attributes.Dept == "Eng" && user.attributes.Name.startsWith("A") || user.attributes.Level in ["Senior", "Staff"]`
		ops := DetectOperatorsInExpression(expr)
		assert.True(t, ops[CELOperatorEquals])
		assert.True(t, ops[CELOperatorStartsWith])
		assert.True(t, ops[CELOperatorOr])
		assert.True(t, ops[CELOperatorIn])
		assert.False(t, ops[CELOperatorNotEquals])
		assert.False(t, ops[CELOperatorContains])
	})

	t.Run("method with space before parenthesis", func(t *testing.T) {
		ops := DetectOperatorsInExpression(`user.attributes.Name.contains ("test")`)
		assert.True(t, ops[CELOperatorContains])
	})
}

func TestFindDisallowedOperators(t *testing.T) {
	t.Run("empty allowed list permits all", func(t *testing.T) {
		result := FindDisallowedOperators(`user.attributes.Dept == "Eng"`, []string{})
		assert.Nil(t, result)
	})

	t.Run("nil allowed list permits all", func(t *testing.T) {
		result := FindDisallowedOperators(`user.attributes.Dept == "Eng"`, nil)
		assert.Nil(t, result)
	})

	t.Run("all operators allowed", func(t *testing.T) {
		allowed := []string{
			CELOperatorEquals, CELOperatorNotEquals, CELOperatorContains,
			CELOperatorStartsWith, CELOperatorEndsWith, CELOperatorIn, CELOperatorOr,
		}
		result := FindDisallowedOperators(
			`user.attributes.Dept == "Eng" || user.attributes.Name.contains("A")`,
			allowed,
		)
		assert.Empty(t, result)
	})

	t.Run("contains disallowed", func(t *testing.T) {
		allowed := []string{CELOperatorEquals, CELOperatorNotEquals}
		result := FindDisallowedOperators(
			`user.attributes.Dept.contains("Eng")`,
			allowed,
		)
		assert.Equal(t, []string{CELOperatorContains}, result)
	})

	t.Run("OR disallowed by default config", func(t *testing.T) {
		allowed := GetDefaultAllowedOperatorsForDelegatedAdmins()
		result := FindDisallowedOperators(
			`user.attributes.Dept == "Eng" || user.attributes.Dept == "Sales"`,
			allowed,
		)
		sort.Strings(result)
		assert.Equal(t, []string{CELOperatorOr}, result)
	})

	t.Run("multiple disallowed operators", func(t *testing.T) {
		allowed := []string{CELOperatorEquals}
		result := FindDisallowedOperators(
			`user.attributes.Dept != "Marketing" || user.attributes.Name.contains("A")`,
			allowed,
		)
		sort.Strings(result)
		assert.Equal(t, []string{CELOperatorNotEquals, CELOperatorContains, CELOperatorOr}, result)
	})

	t.Run("empty expression returns nil", func(t *testing.T) {
		result := FindDisallowedOperators("", []string{CELOperatorEquals})
		assert.Nil(t, result)
	})
}
