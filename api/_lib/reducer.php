<?php
// Padanan PHP dari src/state/reducer.ts — logika murni, sama persis dengan versi Node/Vercel.
require_once __DIR__ . '/constants.php';
require_once __DIR__ . '/seed.php';

function edms_today(): string {
    return gmdate('Y-m-d');
}

function edms_random_suffix(): string {
    return substr(bin2hex(random_bytes(4)), 0, 6);
}

function edms_next_document_code(array $documents, string $type, string $functionId): string {
    $codeMap = edms_document_type_code();
    $prefix = $codeMap[$type] . '-' . strtoupper($functionId);
    $max = 0;
    foreach ($documents as $d) {
        if (strpos($d['code'], $prefix . '-') === 0) {
            $n = (int) substr($d['code'], strrpos($d['code'], '-') + 1);
            $max = max($max, $n);
        }
    }
    return $prefix . '-' . str_pad((string)($max + 1), 3, '0', STR_PAD_LEFT);
}

function edms_next_request_number(array $projects): string {
    $year = gmdate('Y');
    $prefix = "REQ-{$year}-";
    $max = 0;
    foreach ($projects as $p) {
        if (strpos($p['requestNumber'], $prefix) === 0) {
            $n = (int) substr($p['requestNumber'], strrpos($p['requestNumber'], '-') + 1);
            $max = max($max, $n);
        }
    }
    return $prefix . str_pad((string)($max + 1), 3, '0', STR_PAD_LEFT);
}

function edms_make_audit(string $actor, string $action, string $entity, string $entityId, string $detail): array {
    return [
        'id' => 'al-' . edms_now_ms() . '-' . edms_random_suffix(),
        'actor' => $actor,
        'action' => $action,
        'entity' => $entity,
        'entityId' => $entityId,
        'timestamp' => edms_today(),
        'detail' => $detail,
    ];
}

function edms_next_validity_for_status(string $status): string {
    if ($status === 'released') return 'berlaku';
    if ($status === 'obsolete') return 'tidak_berlaku';
    return 'belum_berlaku';
}

function edms_reducer(array $state, array $action): array {
    $type = $action['type'];

    if ($type === 'CREATE_DOCUMENT') {
        $input = $action['input'];
        $actor = $action['actor'];
        $code = edms_next_document_code($state['documents'], $input['type'], $input['functionId']);
        $now = edms_today();
        $doc = [
            'id' => 'doc-' . edms_now_ms(),
            'code' => $code,
            'title' => $input['title'],
            'type' => $input['type'],
            'functionId' => $input['functionId'],
            'standards' => $input['standards'],
            'classification' => $input['classification'],
            'status' => 'draft',
            'validity' => 'belum_berlaku',
            'version' => '0.1',
            'revisionNumber' => 0,
            'effectiveDate' => null,
            'reviewDate' => null,
            'expiryDate' => null,
            'keywords' => $input['keywords'],
            'content' => '',
            'owner' => $input['owner'],
            'relations' => [],
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
        $rev = [
            'id' => $doc['id'] . '-rev0',
            'documentId' => $doc['id'],
            'revisionNumber' => 0,
            'version' => '0.1',
            'date' => $now,
            'editor' => $actor,
            'notes' => 'Draf awal disusun.',
            'status' => 'draft',
            'contentSnapshot' => 'Draf awal: ' . $doc['title'],
        ];
        $state['documents'] = array_merge([$doc], $state['documents']);
        $state['revisions'] = array_merge([$rev], $state['revisions']);
        $state['auditLog'] = array_merge(
            [edms_make_audit($actor, 'create', 'Document', $doc['id'], 'Membuat dokumen "' . $doc['title'] . '" (' . $doc['code'] . ')')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'TRANSITION_STATUS') {
        $documentId = $action['documentId'];
        $toStatus = $action['toStatus'];
        $actor = $action['actor'];
        $note = $action['note'] ?? null;
        $now = edms_today();
        $updatedTitle = '';
        $found = false;
        foreach ($state['documents'] as &$doc) {
            if ($doc['id'] !== $documentId) continue;
            $found = true;
            $updatedTitle = $doc['title'];
            $isRelease = $toStatus === 'released';
            $doc['status'] = $toStatus;
            $doc['validity'] = edms_next_validity_for_status($toStatus);
            if ($isRelease) {
                $doc['version'] = '1.0';
                $doc['revisionNumber'] = $doc['revisionNumber'] + 1;
                $doc['effectiveDate'] = $now;
            }
            $doc['updatedAt'] = $now;
        }
        unset($doc);
        if (!$found) return $state;
        $updatedDoc = null;
        foreach ($state['documents'] as $d) {
            if ($d['id'] === $documentId) { $updatedDoc = $d; break; }
        }
        $rev = [
            'id' => $documentId . '-rev' . $updatedDoc['revisionNumber'] . '-' . edms_now_ms(),
            'documentId' => $documentId,
            'revisionNumber' => $updatedDoc['revisionNumber'],
            'version' => $updatedDoc['version'],
            'date' => $now,
            'editor' => $actor,
            'notes' => $note ?? ('Transisi status ke ' . $toStatus . '.'),
            'status' => $toStatus,
            'contentSnapshot' => $updatedDoc['content'],
        ];
        $state['revisions'] = array_merge([$rev], $state['revisions']);
        $state['auditLog'] = array_merge(
            [edms_make_audit($actor, 'status_change', 'Document', $documentId, 'Status "' . $updatedTitle . '" berubah menjadi ' . $toStatus)],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'MARK_NOTIFICATION_READ') {
        foreach ($state['notifications'] as &$n) {
            if ($n['id'] === $action['id']) $n['read'] = true;
        }
        unset($n);
        return $state;
    }

    if ($type === 'MARK_ALL_NOTIFICATIONS_READ') {
        foreach ($state['notifications'] as &$n) {
            $n['read'] = true;
        }
        unset($n);
        return $state;
    }

    if ($type === 'ADD_FUNCTION') {
        $state['functions'] = array_merge($state['functions'], [$action['dept']]);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'master_data_change', 'FunctionDept', $action['dept']['id'], 'Menambahkan fungsi/departemen "' . $action['dept']['name'] . '"')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADD_STANDARD') {
        $state['standards'] = array_merge($state['standards'], [$action['standard']]);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'master_data_change', 'Standard', $action['standard']['code'], 'Menambahkan standar "' . $action['standard']['name'] . '"')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADD_USER') {
        $state['users'] = array_merge($state['users'], [$action['user']]);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'master_data_change', 'User', $action['user']['id'], 'Menambahkan pengguna "' . $action['user']['name'] . '"')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'TOGGLE_USER_ACTIVE') {
        $name = '';
        $newActive = null;
        foreach ($state['users'] as &$u) {
            if ($u['id'] !== $action['userId']) continue;
            $name = $u['name'];
            $u['active'] = !$u['active'];
            $newActive = $u['active'];
        }
        unset($u);
        if ($newActive === null) return $state;
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'master_data_change', 'User', $action['userId'], ($newActive ? 'Mengaktifkan' : 'Menonaktifkan') . ' pengguna "' . $name . '"')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'CREATE_DRAFTING_REQUEST') {
        $input = $action['input'];
        $actor = $action['actor'];
        $now = edms_today();
        $project = [
            'id' => 'dp-' . edms_now_ms(),
            'requestNumber' => edms_next_request_number($state['draftingProjects']),
            'documentTitle' => $input['documentTitle'],
            'documentType' => $input['documentType'],
            'functionId' => $input['functionId'],
            'standards' => $input['standards'],
            'initialClassification' => $input['initialClassification'],
            'reason' => $input['reason'],
            'requester' => $input['requester'],
            'currentStage' => 'permintaan',
            'meetings' => [],
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
        $state['draftingProjects'] = array_merge([$project], $state['draftingProjects']);
        $state['auditLog'] = array_merge(
            [edms_make_audit($actor, 'create', 'DraftingProject', $project['id'], 'Mengajukan permintaan dokumen "' . $project['documentTitle'] . '" (' . $project['requestNumber'] . ')')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADD_MEETING') {
        $now = edms_today();
        $title = '';
        foreach ($state['draftingProjects'] as &$p) {
            if ($p['id'] !== $action['projectId']) continue;
            $title = $p['documentTitle'];
            $meeting = $action['meeting'];
            $meeting['id'] = 'm-' . edms_now_ms();
            $p['meetings'][] = $meeting;
            $p['updatedAt'] = $now;
        }
        unset($p);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'create', 'DraftingProject', $action['projectId'], 'Mencatat rapat pembahasan baru untuk "' . $title . '"')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'SET_FINALIZED_CONTENT') {
        $now = edms_today();
        $title = '';
        foreach ($state['draftingProjects'] as &$p) {
            if ($p['id'] !== $action['projectId']) continue;
            $title = $p['documentTitle'];
            $p['finalizedContent'] = $action['content'];
            $p['updatedAt'] = $now;
        }
        unset($p);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'create', 'DraftingProject', $action['projectId'], 'Menyimpan konten final "' . $title . '"')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADVANCE_STAGE') {
        $now = edms_today();
        $project = null;
        foreach ($state['draftingProjects'] as $p) {
            if ($p['id'] === $action['projectId']) { $project = $p; break; }
        }
        if ($project === null) return $state;

        $order = edms_drafting_stage_order();
        $idx = array_search($project['currentStage'], $order, true);
        $nextStage = $order[$idx + 1] ?? null;
        if ($nextStage === null) return $state;

        $extraAudit = [];
        $ratifiedDocumentId = $project['ratifiedDocumentId'] ?? null;

        if ($nextStage === 'register_utama') {
            $code = edms_next_document_code($state['documents'], $project['documentType'], $project['functionId']);
            $doc = [
                'id' => 'doc-' . edms_now_ms(),
                'code' => $code,
                'title' => $project['documentTitle'],
                'type' => $project['documentType'],
                'functionId' => $project['functionId'],
                'standards' => $project['standards'],
                'classification' => $project['initialClassification'],
                'status' => 'released',
                'validity' => 'berlaku',
                'version' => '1.0',
                'revisionNumber' => 1,
                'effectiveDate' => $now,
                'reviewDate' => null,
                'expiryDate' => null,
                'keywords' => [],
                'content' => $project['finalizedContent'] ?? ('Dokumen resmi hasil pengesahan permintaan ' . $project['requestNumber'] . '.'),
                'owner' => $project['requester'],
                'relations' => [],
                'createdAt' => $project['createdAt'],
                'updatedAt' => $now,
                'draftingProjectId' => $project['id'],
            ];
            $state['documents'] = array_merge([$doc], $state['documents']);
            $state['revisions'] = array_merge([[
                'id' => $doc['id'] . '-rev1',
                'documentId' => $doc['id'],
                'revisionNumber' => 1,
                'version' => '1.0',
                'date' => $now,
                'editor' => $project['requester'],
                'notes' => 'Diterbitkan dari proses tracking penyusunan (' . $project['requestNumber'] . ').',
                'status' => 'released',
                'contentSnapshot' => $doc['content'],
            ]], $state['revisions']);
            $ratifiedDocumentId = $doc['id'];
            $extraAudit = [edms_make_audit($action['actor'], 'status_change', 'Document', $doc['id'], 'Dokumen "' . $doc['title'] . '" masuk Register Utama (Released) dari ' . $project['requestNumber'])];
        }

        foreach ($state['draftingProjects'] as &$p) {
            if ($p['id'] === $action['projectId']) {
                $p['currentStage'] = $nextStage;
                $p['ratifiedDocumentId'] = $ratifiedDocumentId;
                $p['updatedAt'] = $now;
            }
        }
        unset($p);

        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'status_change', 'DraftingProject', $action['projectId'], 'Tahap "' . $project['documentTitle'] . '" maju ke ' . $nextStage)],
            $extraAudit,
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'RESET_DEMO_DATA') {
        return edms_initial_state();
    }

    return $state;
}
