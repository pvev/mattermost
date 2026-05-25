// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const accessControlTemporaryAccessesTable = "AccessControlTemporaryAccesses"

var accessControlTemporaryAccessColumns = []string{
	"Id",
	"SubjectType",
	"SubjectId",
	"ResourceType",
	"ResourceId",
	"Action",
	"Reason",
	"InviteMode",
	"AcceptedAt",
	"JoinedAt",
	"MembershipCreated",
	"TeamMembershipCreated",
	"CreateAt",
	"UpdateAt",
	"ExpiresAt",
	"DeleteAt",
	"CreatedBy",
	"DeletedBy",
}

type SqlAccessControlTemporaryAccessStore struct {
	*SqlStore

	selectQuery sq.SelectBuilder
}

func newSqlAccessControlTemporaryAccessStore(sqlStore *SqlStore) store.AccessControlTemporaryAccessStore {
	s := &SqlAccessControlTemporaryAccessStore{SqlStore: sqlStore}
	s.selectQuery = s.getQueryBuilder().
		Select(accessControlTemporaryAccessColumns...).
		From(accessControlTemporaryAccessesTable)
	return s
}

func accessControlTemporaryAccessToMap(b *model.AccessControlTemporaryAccess) map[string]any {
	return map[string]any{
		"Id":                    b.ID,
		"SubjectType":           b.SubjectType,
		"SubjectId":             b.SubjectID,
		"ResourceType":          b.ResourceType,
		"ResourceId":            b.ResourceID,
		"Action":                b.Action,
		"Reason":                b.Reason,
		"InviteMode":            b.InviteMode,
		"AcceptedAt":            b.AcceptedAt,
		"JoinedAt":              b.JoinedAt,
		"MembershipCreated":     b.MembershipCreated,
		"TeamMembershipCreated": b.TeamMembershipCreated,
		"CreateAt":              b.CreateAt,
		"UpdateAt":              b.UpdateAt,
		"ExpiresAt":             b.ExpiresAt,
		"DeleteAt":              b.DeleteAt,
		"CreatedBy":             b.CreatedBy,
		"DeletedBy":             b.DeletedBy,
	}
}

func (s *SqlAccessControlTemporaryAccessStore) Save(rctx request.CTX, temporaryAccesses []*model.AccessControlTemporaryAccess) ([]*model.AccessControlTemporaryAccess, error) {
	if len(temporaryAccesses) == 0 {
		return []*model.AccessControlTemporaryAccess{}, nil
	}

	tx, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "failed to start transaction")
	}
	defer finalizeTransactionX(tx, &err)

	for _, temporaryAccess := range temporaryAccesses {
		temporaryAccess.PreSave()
		if appErr := temporaryAccess.IsValid(); appErr != nil {
			return nil, appErr
		}

		query := s.getQueryBuilder().
			Insert(accessControlTemporaryAccessesTable).
			SetMap(accessControlTemporaryAccessToMap(temporaryAccess))
		if _, err = tx.ExecBuilder(query); err != nil {
			return nil, errors.Wrapf(err, "failed to save AccessControlTemporaryAccess with id=%s", temporaryAccess.ID)
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return temporaryAccesses, nil
}

func (s *SqlAccessControlTemporaryAccessStore) Get(_ request.CTX, id string) (*model.AccessControlTemporaryAccess, error) {
	if !model.IsValidId(id) {
		return nil, store.NewErrInvalidInput("AccessControlTemporaryAccess", "id", id)
	}

	var temporaryAccess model.AccessControlTemporaryAccess
	query := s.selectQuery.Where(sq.Eq{"Id": id})
	if err := s.GetReplica().GetBuilder(&temporaryAccess, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("AccessControlTemporaryAccess", id)
		}
		return nil, errors.Wrapf(err, "failed to get AccessControlTemporaryAccess with id=%s", id)
	}

	return &temporaryAccess, nil
}

func (s *SqlAccessControlTemporaryAccessStore) Search(_ request.CTX, opts model.AccessControlTemporaryAccessSearch) ([]*model.AccessControlTemporaryAccess, int64, error) {
	where := sq.And{}
	if opts.SubjectType != "" {
		where = append(where, sq.Eq{"SubjectType": opts.SubjectType})
	}
	if opts.SubjectID != "" {
		where = append(where, sq.Eq{"SubjectId": opts.SubjectID})
	}
	if opts.ResourceType != "" {
		where = append(where, sq.Eq{"ResourceType": opts.ResourceType})
	}
	if opts.ResourceID != "" {
		where = append(where, sq.Eq{"ResourceId": opts.ResourceID})
	}
	if opts.Action != "" {
		where = append(where, sq.Eq{"Action": opts.Action})
	}
	if opts.CreatedBy != "" {
		where = append(where, sq.Eq{"CreatedBy": opts.CreatedBy})
	}

	now := model.GetMillis()
	switch opts.Status {
	case model.AccessControlTemporaryAccessStatusActive:
		where = append(where, sq.Eq{"DeleteAt": 0}, sq.Gt{"ExpiresAt": now})
	case model.AccessControlTemporaryAccessStatusExpired:
		where = append(where, sq.Eq{"DeleteAt": 0}, sq.LtOrEq{"ExpiresAt": now})
	case model.AccessControlTemporaryAccessStatusRevoked:
		where = append(where, sq.NotEq{"DeleteAt": 0})
	}

	perPage := opts.PerPage
	if perPage <= 0 {
		perPage = DefaultPerPage
	}
	if perPage > MaxPerPage {
		perPage = MaxPerPage
	}
	page := max(opts.Page, 0)

	listQuery := s.selectQuery.
		Where(where).
		OrderBy("CreateAt DESC", "Id DESC").
		Limit(uint64(perPage)).
		Offset(uint64(page * perPage))

	var temporaryAccesses []*model.AccessControlTemporaryAccess
	if err := s.GetReplica().SelectBuilder(&temporaryAccesses, listQuery); err != nil {
		return nil, 0, errors.Wrap(err, "failed to search AccessControlTemporaryAccesses")
	}

	countQuery := s.getQueryBuilder().
		Select("COUNT(*)").
		From(accessControlTemporaryAccessesTable).
		Where(where)

	var total int64
	if err := s.GetReplica().GetBuilder(&total, countQuery); err != nil {
		return nil, 0, errors.Wrap(err, "failed to count AccessControlTemporaryAccesses")
	}

	return temporaryAccesses, total, nil
}

func (s *SqlAccessControlTemporaryAccessStore) Revoke(rctx request.CTX, id string, deleteAt int64, deletedBy string) (*model.AccessControlTemporaryAccess, error) {
	if !model.IsValidId(id) {
		return nil, store.NewErrInvalidInput("AccessControlTemporaryAccess", "id", id)
	}
	if deletedBy != "" && !model.IsValidId(deletedBy) {
		return nil, store.NewErrInvalidInput("AccessControlTemporaryAccess", "deletedBy", deletedBy)
	}
	if deleteAt == 0 {
		deleteAt = model.GetMillis()
	}

	query := s.getQueryBuilder().
		Update(accessControlTemporaryAccessesTable).
		Set("DeleteAt", deleteAt).
		Set("DeletedBy", deletedBy).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": id})

	res, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to revoke AccessControlTemporaryAccess with id=%s", id)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to read RowsAffected on AccessControlTemporaryAccess revoke")
	}
	if rows == 0 {
		return nil, store.NewErrNotFound("AccessControlTemporaryAccess", id)
	}

	return s.Get(rctx, id)
}

func (s *SqlAccessControlTemporaryAccessStore) MarkAccepted(rctx request.CTX, id string, acceptedAt int64, joinedAt int64, membershipCreated bool) (*model.AccessControlTemporaryAccess, error) {
	if !model.IsValidId(id) {
		return nil, store.NewErrInvalidInput("AccessControlTemporaryAccess", "id", id)
	}
	if acceptedAt == 0 {
		acceptedAt = model.GetMillis()
	}

	query := s.getQueryBuilder().
		Update(accessControlTemporaryAccessesTable).
		Set("AcceptedAt", acceptedAt).
		Set("JoinedAt", joinedAt).
		Set("MembershipCreated", membershipCreated).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": id})

	res, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to mark AccessControlTemporaryAccess accepted with id=%s", id)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to read RowsAffected on AccessControlTemporaryAccess accept")
	}
	if rows == 0 {
		return nil, store.NewErrNotFound("AccessControlTemporaryAccess", id)
	}

	return s.Get(rctx, id)
}

func (s *SqlAccessControlTemporaryAccessStore) MarkJoined(rctx request.CTX, id string, joinedAt int64, membershipCreated bool, teamMembershipCreated bool) (*model.AccessControlTemporaryAccess, error) {
	if !model.IsValidId(id) {
		return nil, store.NewErrInvalidInput("AccessControlTemporaryAccess", "id", id)
	}
	if joinedAt == 0 {
		joinedAt = model.GetMillis()
	}

	query := s.getQueryBuilder().
		Update(accessControlTemporaryAccessesTable).
		Set("JoinedAt", joinedAt).
		Set("MembershipCreated", membershipCreated).
		Set("TeamMembershipCreated", teamMembershipCreated).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": id})

	res, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to mark AccessControlTemporaryAccess joined with id=%s", id)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to read RowsAffected on AccessControlTemporaryAccess join")
	}
	if rows == 0 {
		return nil, store.NewErrNotFound("AccessControlTemporaryAccess", id)
	}

	return s.Get(rctx, id)
}

func (s *SqlAccessControlTemporaryAccessStore) HasActive(_ request.CTX, check model.AccessControlTemporaryAccessActiveCheck) (bool, error) {
	if check.Now == 0 {
		check.Now = model.GetMillis()
	}

	query := s.getQueryBuilder().
		Select("1").
		From(accessControlTemporaryAccessesTable).
		Where(sq.Eq{
			"SubjectType":  check.SubjectType,
			"SubjectId":    check.SubjectID,
			"ResourceType": check.ResourceType,
			"ResourceId":   check.ResourceID,
			"Action":       check.Action,
			"DeleteAt":     0,
		}).
		Where(sq.Gt{"ExpiresAt": check.Now}).
		Limit(1)

	var found int
	if err := s.GetReplica().GetBuilder(&found, query); err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, errors.Wrap(err, "failed to check active AccessControlTemporaryAccess")
	}

	return true, nil
}

func (s *SqlAccessControlTemporaryAccessStore) GetExpiredBatch(_ request.CTX, now int64, limit int) ([]*model.AccessControlTemporaryAccess, error) {
	if now == 0 {
		now = model.GetMillis()
	}
	if limit <= 0 {
		return nil, store.NewErrInvalidInput("AccessControlTemporaryAccess", "limit", limit)
	}

	query := s.selectQuery.
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.LtOrEq{"ExpiresAt": now}).
		OrderBy("ExpiresAt ASC", "Id ASC").
		Limit(uint64(limit))

	var temporaryAccesses []*model.AccessControlTemporaryAccess
	if err := s.GetReplica().SelectBuilder(&temporaryAccesses, query); err != nil {
		return nil, errors.Wrap(err, "failed to get expired AccessControlTemporaryAccesses")
	}

	return temporaryAccesses, nil
}

func (s *SqlAccessControlTemporaryAccessStore) DeleteByIDs(_ request.CTX, ids []string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	for _, id := range ids {
		if !model.IsValidId(id) {
			return 0, store.NewErrInvalidInput("AccessControlTemporaryAccess", "id", id)
		}
	}

	query := s.getQueryBuilder().
		Delete(accessControlTemporaryAccessesTable).
		Where(sq.Eq{"Id": ids})

	res, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete AccessControlTemporaryAccesses by ids")
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "failed to read RowsAffected on AccessControlTemporaryAccess delete")
	}

	return rows, nil
}

func (s *SqlAccessControlTemporaryAccessStore) DeleteExpiredBatch(_ request.CTX, now int64, limit int) (int64, error) {
	if now == 0 {
		now = model.GetMillis()
	}
	if limit <= 0 {
		return 0, store.NewErrInvalidInput("AccessControlTemporaryAccess", "limit", limit)
	}

	query := "DELETE FROM AccessControlTemporaryAccesses WHERE Id = any (array (SELECT Id FROM AccessControlTemporaryAccesses WHERE ExpiresAt <= ? LIMIT ?))"
	res, err := s.GetMaster().Exec(query, now, limit)
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete expired AccessControlTemporaryAccesses")
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "failed to read RowsAffected on expired AccessControlTemporaryAccesses delete")
	}

	return rows, nil
}
