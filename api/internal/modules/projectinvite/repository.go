package projectinvite

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/internal/modules/project"
	"github.com/kest-labs/kest/api/pkg/dbutil"
)

type Repository interface {
	CreateInvitation(ctx context.Context, invitation *ProjectInvitation, tokenHash string) error
	ListInvitationsByProject(ctx context.Context, projectID string) ([]*ProjectInvitation, error)
	ListInvitationsByInvitedUser(ctx context.Context, userID string) ([]*ProjectInvitation, error)
	GetInvitationByProject(ctx context.Context, projectID, invitationID string) (*ProjectInvitation, error)
	GetInvitationBySlug(ctx context.Context, slug string) (*ProjectInvitation, error)
	UpdateInvitation(ctx context.Context, invitation *ProjectInvitation) error
	GetProjectSummary(ctx context.Context, projectID string) (*ProjectSummary, error)
	ListPendingInvitationsForUser(ctx context.Context, userID string, now time.Time) ([]*PendingProjectInvitation, error)
	AcceptInvitation(ctx context.Context, invitation *ProjectInvitation, userID string, acceptedAt time.Time) error
	RevokeActiveInvitationsForUser(ctx context.Context, projectID, userID string) error
	HasProjectMember(ctx context.Context, projectID, userID string) (bool, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) CreateInvitation(ctx context.Context, invitation *ProjectInvitation, tokenHash string) error {
	po := newProjectInvitationPO(invitation, tokenHash)
	if err := r.db.WithContext(ctx).Create(po).Error; err != nil {
		return err
	}

	invitation.ID = po.ID
	invitation.CreatedAt = po.CreatedAt
	invitation.UpdatedAt = po.UpdatedAt
	return nil
}

func (r *repository) ListInvitationsByProject(ctx context.Context, projectID string) ([]*ProjectInvitation, error) {
	var poList []ProjectInvitationPO
	if err := r.db.WithContext(ctx).
		Preload("InvitedUser").
		Where("project_id = ?", projectID).
		Order("created_at DESC").
		Find(&poList).Error; err != nil {
		return nil, err
	}

	result := make([]*ProjectInvitation, 0, len(poList))
	for i := range poList {
		result = append(result, poList[i].toDomain())
	}
	return result, nil
}

func (r *repository) ListInvitationsByInvitedUser(
	ctx context.Context,
	userID string,
) ([]*ProjectInvitation, error) {
	var poList []ProjectInvitationPO
	if err := r.db.WithContext(ctx).
		Preload("InvitedUser").
		Where("invited_user_id = ?", userID).
		Order("created_at DESC").
		Find(&poList).Error; err != nil {
		return nil, err
	}

	result := make([]*ProjectInvitation, 0, len(poList))
	for i := range poList {
		result = append(result, poList[i].toDomain())
	}
	return result, nil
}

func (r *repository) GetInvitationByProject(
	ctx context.Context,
	projectID, invitationID string,
) (*ProjectInvitation, error) {
	var po ProjectInvitationPO
	if err := r.db.WithContext(ctx).
		Preload("InvitedUser").
		Where("project_id = ? AND id = ?", projectID, invitationID).
		First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) GetInvitationBySlug(ctx context.Context, slug string) (*ProjectInvitation, error) {
	var po ProjectInvitationPO
	if err := r.db.WithContext(ctx).
		Preload("InvitedUser").
		Where("slug = ?", slug).
		First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) UpdateInvitation(ctx context.Context, invitation *ProjectInvitation) error {
	po := newProjectInvitationPO(invitation, "")
	return r.db.WithContext(ctx).
		Model(&ProjectInvitationPO{}).
		Where("id = ?", invitation.ID).
		Updates(map[string]any{
			"role":            po.Role,
			"status":          po.Status,
			"invited_user_id": po.InvitedUserID,
			"max_uses":        po.MaxUses,
			"used_count":      po.UsedCount,
			"expires_at":      po.ExpiresAt,
			"last_used_at":    po.LastUsedAt,
			"updated_at":      time.Now().UTC(),
		}).Error
}

func (r *repository) RevokeActiveInvitationsForUser(
	ctx context.Context,
	projectID, userID string,
) error {
	return r.db.WithContext(ctx).
		Model(&ProjectInvitationPO{}).
		Where("project_id = ? AND invited_user_id = ? AND status = ?", projectID, userID, InvitationStatusActive).
		Updates(map[string]any{
			"status":     InvitationStatusRevoked,
			"updated_at": time.Now().UTC(),
		}).Error
}

func (r *repository) GetProjectSummary(ctx context.Context, projectID string) (*ProjectSummary, error) {
	var po project.ProjectPO
	if err := dbutil.ByID(r.db.WithContext(ctx), projectID).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &ProjectSummary{
		ID:   po.ID,
		Name: po.Name,
		Slug: po.Slug,
	}, nil
}

func (r *repository) ListPendingInvitationsForUser(
	ctx context.Context,
	userID string,
	now time.Time,
) ([]*PendingProjectInvitation, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, nil
	}

	var poList []ProjectInvitationPO
	if err := r.db.WithContext(ctx).
		Where("target_user_id = ?", userID).
		Where("status = ?", InvitationStatusActive).
		Where("(expires_at IS NULL OR expires_at > ?)", now).
		Where("(max_uses = 0 OR used_count < max_uses)").
		Order("created_at DESC").
		Limit(50).
		Find(&poList).Error; err != nil {
		return nil, err
	}
	if len(poList) == 0 {
		return []*PendingProjectInvitation{}, nil
	}

	projectIDs := make([]string, 0, len(poList))
	inviterIDs := make([]string, 0, len(poList))
	for _, po := range poList {
		projectIDs = append(projectIDs, po.ProjectID)
		inviterIDs = append(inviterIDs, po.CreatedBy)
	}

	var projectPOs []project.ProjectPO
	if err := r.db.WithContext(ctx).
		Where("id IN ?", projectIDs).
		Find(&projectPOs).Error; err != nil {
		return nil, err
	}
	projectByID := make(map[string]*ProjectSummary, len(projectPOs))
	for i := range projectPOs {
		projectByID[projectPOs[i].ID] = &ProjectSummary{
			ID:   projectPOs[i].ID,
			Name: projectPOs[i].Name,
			Slug: projectPOs[i].Slug,
		}
	}

	var userPOs []user.UserPO
	if err := r.db.WithContext(ctx).
		Where("id IN ?", inviterIDs).
		Find(&userPOs).Error; err != nil {
		return nil, err
	}
	userByID := make(map[string]*InvitationUserSummary, len(userPOs))
	for i := range userPOs {
		userByID[userPOs[i].ID] = &InvitationUserSummary{
			ID:       userPOs[i].ID,
			Name:     userPOs[i].Nickname,
			Email:    userPOs[i].Email,
			Avatar:   userPOs[i].Avatar,
			Username: userPOs[i].Username,
			Nickname: userPOs[i].Nickname,
		}
	}

	result := make([]*PendingProjectInvitation, 0, len(poList))
	for i := range poList {
		invitation := poList[i].toDomain()
		projectSummary := projectByID[invitation.ProjectID]
		if projectSummary == nil {
			continue
		}

		result = append(result, &PendingProjectInvitation{
			Invitation: invitation,
			Project:    projectSummary,
			Inviter:    userByID[invitation.CreatedBy],
		})
	}
	return result, nil
}

func (r *repository) AcceptInvitation(
	ctx context.Context,
	invitation *ProjectInvitation,
	userID string,
	acceptedAt time.Time,
) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var po ProjectInvitationPO
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", invitation.ID).
			First(&po).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrProjectInvitationNotFound
			}
			return err
		}

		current := po.toDomain()
		if err := validateInvitationCanBeAccepted(current, acceptedAt); err != nil {
			if err == ErrProjectInvitationExpired && current.Status == InvitationStatusActive {
				if updateErr := tx.Model(&ProjectInvitationPO{}).
					Where("id = ?", current.ID).
					Update("status", InvitationStatusExpired).Error; updateErr != nil {
					return updateErr
				}
			}
			return err
		}
		if current.TargetUserID != "" && current.TargetUserID != userID {
			return ErrProjectInvitationNotFound
		}

		var existing member.ProjectMemberPO
		if err := tx.Where("project_id = ? AND user_id = ?", current.ProjectID, userID).
			First(&existing).Error; err == nil {
			return ErrProjectInvitationAlreadyMember
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		projectMember := &member.ProjectMemberPO{
			ProjectID: current.ProjectID,
			UserID:    userID,
			Role:      current.Role,
		}
		if err := tx.Create(projectMember).Error; err != nil {
			if looksLikeProjectMemberConflict(err) {
				return ErrProjectInvitationAlreadyMember
			}
			return err
		}

		return tx.Model(&ProjectInvitationPO{}).
			Where("id = ?", current.ID).
			Updates(map[string]any{
				"used_count":   gorm.Expr("used_count + ?", 1),
				"last_used_at": acceptedAt,
				"updated_at":   acceptedAt,
			}).Error
	})
}

func looksLikeProjectMemberConflict(err error) bool {
	if err == nil {
		return false
	}

	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "idx_project_user")
}

func (r *repository) HasProjectMember(ctx context.Context, projectID, userID string) (bool, error) {
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&member.ProjectMemberPO{}).
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Count(&count).Error; err != nil {
		return false, err
	}

	return count > 0, nil
}
