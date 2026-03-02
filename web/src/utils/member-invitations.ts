export interface PendingMemberInvitation {
    projectId: number
    token: string
    createdAt: string
}

const STORAGE_KEY = 'kest_pending_member_invitations'

export function getPendingMemberInvitations(): PendingMemberInvitation[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter((item) =>
            item &&
            Number.isInteger(item.projectId) &&
            item.projectId > 0 &&
            typeof item.token === 'string' &&
            item.token.length > 0 &&
            typeof item.createdAt === 'string'
        )
    } catch {
        return []
    }
}

export function savePendingMemberInvitations(items: PendingMemberInvitation[]) {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function upsertPendingMemberInvitation(projectId: number, token: string) {
    const existing = getPendingMemberInvitations()
    const alreadyExists = existing.some((item) => item.projectId === projectId && item.token === token)
    const next = existing.filter((item) => !(item.projectId === projectId && item.token === token))
    next.push({
        projectId,
        token,
        createdAt: new Date().toISOString(),
    })
    savePendingMemberInvitations(next)
    return { items: next, added: !alreadyExists }
}

export function removePendingMemberInvitation(projectId: number, token: string) {
    const existing = getPendingMemberInvitations()
    const next = existing.filter((item) => !(item.projectId === projectId && item.token === token))
    savePendingMemberInvitations(next)
    return next
}
