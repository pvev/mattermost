// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildCELFromConditions(t *testing.T) {
	t.Run("empty conditions returns true", func(t *testing.T) {
		result := buildCELFromConditions(nil)
		assert.Equal(t, "true", result)
	})

	t.Run("equals operator", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Team", Operator: "==", Value: "Engineering", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Team == "Engineering"`, result)
	})

	t.Run("not equals operator", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Location", Operator: "!=", Value: "Building 7", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Location != "Building 7"`, result)
	})

	t.Run("in operator with select field", func(t *testing.T) {
		conditions := []model.Condition{
			{
				Attribute:     "user.attributes.Department",
				Operator:      "in",
				Value:         []any{"Sales", "Engineering", "Legal"},
				ValueType:     model.LiteralValue,
				AttributeType: "select",
			},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Department in ["Sales", "Engineering", "Legal"]`, result)
	})

	t.Run("in operator with multiselect field", func(t *testing.T) {
		conditions := []model.Condition{
			{
				Attribute:     "user.attributes.Programs",
				Operator:      "in",
				Value:         []any{"Alpha", "Bravo"},
				ValueType:     model.LiteralValue,
				AttributeType: "multiselect",
			},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `"Alpha" in user.attributes.Programs && "Bravo" in user.attributes.Programs`, result)
	})

	t.Run("hasAnyOf operator", func(t *testing.T) {
		conditions := []model.Condition{
			{
				Attribute:     "user.attributes.Programs",
				Operator:      "hasAnyOf",
				Value:         []any{"Alpha", "Bravo"},
				ValueType:     model.LiteralValue,
				AttributeType: "multiselect",
			},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `("Alpha" in user.attributes.Programs || "Bravo" in user.attributes.Programs)`, result)
	})

	t.Run("hasAnyOf with single value omits parens", func(t *testing.T) {
		conditions := []model.Condition{
			{
				Attribute:     "user.attributes.Programs",
				Operator:      "hasAnyOf",
				Value:         []any{"Alpha"},
				ValueType:     model.LiteralValue,
				AttributeType: "multiselect",
			},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `"Alpha" in user.attributes.Programs`, result)
	})

	t.Run("hasAllOf operator", func(t *testing.T) {
		conditions := []model.Condition{
			{
				Attribute:     "user.attributes.Programs",
				Operator:      "hasAllOf",
				Value:         []any{"Alpha", "Bravo"},
				ValueType:     model.LiteralValue,
				AttributeType: "multiselect",
			},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `"Alpha" in user.attributes.Programs && "Bravo" in user.attributes.Programs`, result)
	})

	t.Run("contains operator", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Email", Operator: "contains", Value: "@company.com", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Email.contains("@company.com")`, result)
	})

	t.Run("startsWith operator", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Name", Operator: "startsWith", Value: "Dr.", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Name.startsWith("Dr.")`, result)
	})

	t.Run("endsWith operator", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Email", Operator: "endsWith", Value: ".gov", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Email.endsWith(".gov")`, result)
	})

	t.Run("multiple conditions joined with &&", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Team", Operator: "==", Value: "Engineering", ValueType: model.LiteralValue},
			{Attribute: "user.attributes.Location", Operator: "!=", Value: "Remote", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Team == "Engineering" && user.attributes.Location != "Remote"`, result)
	})

	t.Run("string with special characters is escaped", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Team", Operator: "==", Value: `Team "Alpha"`, ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Team == "Team \"Alpha\""`, result)
	})

	t.Run("boolean value", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Active", Operator: "==", Value: true, ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Active == true`, result)
	})

	t.Run("empty in-list produces no output", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Department", Operator: "in", Value: []any{}, ValueType: model.LiteralValue, AttributeType: "select"},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, "true", result)
	})
}

func TestExtractStringValues(t *testing.T) {
	t.Run("slice of strings", func(t *testing.T) {
		result := extractStringValues([]any{"Alpha", "Bravo", "Charlie"})
		assert.Equal(t, []string{"Alpha", "Bravo", "Charlie"}, result)
	})

	t.Run("single string", func(t *testing.T) {
		result := extractStringValues("Alpha")
		assert.Equal(t, []string{"Alpha"}, result)
	})

	t.Run("nil", func(t *testing.T) {
		result := extractStringValues(nil)
		assert.Nil(t, result)
	})

	t.Run("mixed types in slice", func(t *testing.T) {
		result := extractStringValues([]any{"Alpha", 42, "Bravo"})
		assert.Equal(t, []string{"Alpha", "Bravo"}, result)
	})

	t.Run("non-string non-slice", func(t *testing.T) {
		result := extractStringValues(42)
		assert.Nil(t, result)
	})
}

func TestMergeConditionValues(t *testing.T) {
	t.Run("no hidden values returns submitted as-is", func(t *testing.T) {
		submitted := model.Condition{
			Attribute: "user.attributes.Program",
			Operator:  "in",
			Value:     []any{"Alpha"},
		}
		result := mergeConditionValues(submitted, nil)
		assert.Equal(t, []any{"Alpha"}, result.Value)
	})

	t.Run("appends hidden values to multi-value", func(t *testing.T) {
		submitted := model.Condition{
			Attribute: "user.attributes.Program",
			Operator:  "in",
			Value:     []any{"Alpha"},
		}
		result := mergeConditionValues(submitted, []string{"Bravo", "Charlie"})
		values, ok := result.Value.([]any)
		require.True(t, ok)
		assert.Len(t, values, 3)
		assert.Contains(t, values, "Alpha")
		assert.Contains(t, values, "Bravo")
		assert.Contains(t, values, "Charlie")
	})

	t.Run("deduplicates values", func(t *testing.T) {
		submitted := model.Condition{
			Attribute: "user.attributes.Program",
			Operator:  "in",
			Value:     []any{"Alpha", "Bravo"},
		}
		result := mergeConditionValues(submitted, []string{"Bravo", "Charlie"})
		values, ok := result.Value.([]any)
		require.True(t, ok)
		assert.Len(t, values, 3) // Alpha, Bravo, Charlie — no duplicate Bravo
	})

	t.Run("restores hidden values when submitted is nil", func(t *testing.T) {
		submitted := model.Condition{
			Attribute: "user.attributes.Program",
			Operator:  "in",
			Value:     nil,
		}
		result := mergeConditionValues(submitted, []string{"Bravo", "Charlie"})
		values, ok := result.Value.([]any)
		require.True(t, ok)
		assert.Len(t, values, 2)
	})

	t.Run("restores single hidden value when submitted is nil", func(t *testing.T) {
		submitted := model.Condition{
			Attribute: "user.attributes.Location",
			Operator:  "==",
			Value:     nil,
		}
		result := mergeConditionValues(submitted, []string{"Building 7"})
		assert.Equal(t, "Building 7", result.Value)
	})
}

func TestCelStringLiteral(t *testing.T) {
	assert.Equal(t, `"hello"`, celStringLiteral("hello"))
	assert.Equal(t, `"hello \"world\""`, celStringLiteral(`hello "world"`))
	assert.Equal(t, `"path\\to\\file"`, celStringLiteral(`path\to\file`))
	assert.Equal(t, `""`, celStringLiteral(""))
}

func TestCelValueLiteral(t *testing.T) {
	assert.Equal(t, `"hello"`, celValueLiteral("hello"))
	assert.Equal(t, "true", celValueLiteral(true))
	assert.Equal(t, "false", celValueLiteral(false))
	assert.Equal(t, "42", celValueLiteral(int(42)))
	assert.Equal(t, "42", celValueLiteral(int64(42)))
	assert.Equal(t, "3.14", celValueLiteral(float64(3.14)))
	assert.Equal(t, "null", celValueLiteral(nil))
}
