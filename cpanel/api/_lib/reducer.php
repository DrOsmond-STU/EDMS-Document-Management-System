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

    if ($type === 'SET_USER_PASSWORD') {
        $name = '';
        foreach ($state['users'] as &$u) {
            if ($u['id'] !== $action['userId']) continue;
            $name = $u['name'];
            $u['passwordHash'] = $action['passwordHash'];
        }
        unset($u);
        if ($name === '') return $state;
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'master_data_change', 'User', $action['userId'], 'Mengganti password akun "' . $name . '"')],
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

    // -----------------------------------------------------------------
    // Risk management
    // -----------------------------------------------------------------
    if ($type === 'CREATE_RISK') {
        $input = $action['input'];
        $actor = $action['actor'];
        $now = edms_today();
        $risk = [
            'id' => 'rsk-' . edms_now_ms(),
            'code' => edms_next_code_for($state['risks'] ?? [], 'RSK'),
            'title' => $input['title'],
            'description' => $input['description'],
            'category' => $input['category'],
            'functionId' => $input['functionId'],
            'owner' => $input['owner'],
            'standards' => $input['standards'] ?? [],
            'inherentLikelihood' => (int) $input['inherentLikelihood'],
            'inherentImpact' => (int) $input['inherentImpact'],
            'inherentLevel' => edms_risk_level_for((int) $input['inherentLikelihood'], (int) $input['inherentImpact']),
            'treatment' => $input['treatment'],
            'treatmentPlan' => $input['treatmentPlan'],
            'controls' => [],
            'residualLikelihood' => (int) $input['residualLikelihood'],
            'residualImpact' => (int) $input['residualImpact'],
            'residualLevel' => edms_risk_level_for((int) $input['residualLikelihood'], (int) $input['residualImpact']),
            'status' => 'assessed',
            'reviewDate' => $input['reviewDate'] ?? null,
            'reviews' => [],
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
        $state['risks'] = array_merge([$risk], $state['risks'] ?? []);
        $state['auditLog'] = array_merge(
            [edms_make_audit($actor, 'create', 'Risk', $risk['id'], 'Menambahkan risiko "' . $risk['title'] . '" (' . $risk['code'] . ')')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'UPDATE_RISK_STATUS') {
        $now = edms_today();
        $title = '';
        foreach ($state['risks'] as &$r) {
            if ($r['id'] === $action['riskId']) {
                $title = $r['title'];
                $r['status'] = $action['status'];
                $r['updatedAt'] = $now;
            }
        }
        unset($r);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'status_change', 'Risk', $action['riskId'], 'Status risiko "' . $title . '" → ' . $action['status'])],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADD_RISK_CONTROL') {
        $now = edms_today();
        $title = '';
        foreach ($state['risks'] as &$r) {
            if ($r['id'] === $action['riskId']) {
                $title = $r['title'];
                $r['controls'][] = array_merge(['id' => 'rc-' . edms_now_ms()], $action['control']);
                $r['updatedAt'] = $now;
            }
        }
        unset($r);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'create', 'RiskControl', $action['riskId'], 'Menambahkan kontrol untuk risiko "' . $title . '"')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADD_RISK_REVIEW') {
        $now = edms_today();
        $title = '';
        foreach ($state['risks'] as &$r) {
            if ($r['id'] === $action['riskId']) {
                $title = $r['title'];
                $review = array_merge(['id' => 'rr-' . edms_now_ms()], $action['review']);
                array_unshift($r['reviews'], $review);
                $r['status'] = 'monitored';
                $r['updatedAt'] = $now;
            }
        }
        unset($r);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'view', 'Risk', $action['riskId'], 'Meninjau risiko "' . $title . '"')],
            $state['auditLog'],
        );
        return $state;
    }

    // -----------------------------------------------------------------
    // Internal / external audit
    // -----------------------------------------------------------------
    if ($type === 'CREATE_INTERNAL_AUDIT') {
        $input = $action['input'];
        $now = edms_today();
        $audit = [
            'id' => 'ia-' . edms_now_ms(),
            'code' => edms_next_code_for($state['internalAudits'] ?? [], 'IA'),
            'title' => $input['title'],
            'scope' => $input['scope'],
            'standards' => $input['standards'] ?? [],
            'auditeeFunctionIds' => $input['auditeeFunctionIds'] ?? [],
            'leadAuditor' => $input['leadAuditor'],
            'auditors' => $input['auditors'] ?? [],
            'plannedStartDate' => $input['plannedStartDate'],
            'plannedEndDate' => $input['plannedEndDate'],
            'status' => 'scheduled',
            'objectives' => $input['objectives'] ?? '',
            'checklist' => [],
            'findingIds' => [],
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
        $state['internalAudits'] = array_merge([$audit], $state['internalAudits'] ?? []);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'create', 'InternalAudit', $audit['id'], 'Menjadwalkan audit internal "' . $audit['title'] . '" (' . $audit['code'] . ')')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'CREATE_EXTERNAL_AUDIT') {
        $input = $action['input'];
        $now = edms_today();
        $audit = [
            'id' => 'ea-' . edms_now_ms(),
            'code' => edms_next_code_for($state['externalAudits'] ?? [], 'EA'),
            'title' => $input['title'],
            'kind' => $input['kind'],
            'auditingBody' => $input['auditingBody'],
            'standards' => $input['standards'] ?? [],
            'scope' => $input['scope'],
            'contactPerson' => $input['contactPerson'],
            'plannedStartDate' => $input['plannedStartDate'],
            'plannedEndDate' => $input['plannedEndDate'],
            'status' => 'scheduled',
            'findingIds' => [],
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
        $state['externalAudits'] = array_merge([$audit], $state['externalAudits'] ?? []);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'create', 'ExternalAudit', $audit['id'], 'Menjadwalkan audit eksternal "' . $audit['title'] . '" (' . $audit['code'] . ')')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'UPDATE_AUDIT_STATUS') {
        $now = edms_today();
        $label = '';
        if ($action['auditSource'] === 'internal') {
            foreach ($state['internalAudits'] as &$a) {
                if ($a['id'] === $action['auditId']) {
                    $label = 'IA "' . $a['title'] . '"';
                    $a['status'] = $action['status'];
                    $a['updatedAt'] = $now;
                }
            }
            unset($a);
        } else {
            foreach ($state['externalAudits'] as &$a) {
                if ($a['id'] === $action['auditId']) {
                    $label = 'EA "' . $a['title'] . '"';
                    $a['status'] = $action['status'];
                    $a['updatedAt'] = $now;
                }
            }
            unset($a);
        }
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'status_change', $action['auditSource'] === 'internal' ? 'InternalAudit' : 'ExternalAudit', $action['auditId'], 'Status ' . $label . ' → ' . $action['status'])],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADD_FINDING') {
        $input = $action['input'];
        $finding = [
            'id' => 'fnd-' . edms_now_ms(),
            'code' => edms_next_code_for($state['findings'] ?? [], 'FND'),
            'auditId' => $input['auditId'],
            'auditSource' => $input['auditSource'],
            'clauseReference' => $input['clauseReference'],
            'standards' => $input['standards'] ?? [],
            'type' => $input['type'],
            'title' => $input['title'],
            'description' => $input['description'],
            'evidence' => $input['evidence'],
            'functionId' => $input['functionId'],
            'owner' => $input['owner'],
            'raisedBy' => $input['raisedBy'],
            'raisedDate' => $input['raisedDate'],
            'dueDate' => $input['dueDate'],
            'status' => 'open',
            'capa' => [],
            'verifications' => [],
        ];
        $state['findings'] = array_merge([$finding], $state['findings'] ?? []);
        if ($input['auditSource'] === 'internal') {
            foreach ($state['internalAudits'] as &$a) {
                if ($a['id'] === $input['auditId']) $a['findingIds'][] = $finding['id'];
            }
            unset($a);
        } else {
            foreach ($state['externalAudits'] as &$a) {
                if ($a['id'] === $input['auditId']) $a['findingIds'][] = $finding['id'];
            }
            unset($a);
        }
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'create', 'Finding', $finding['id'], 'Menambahkan temuan "' . $finding['title'] . '" (' . $finding['code'] . ')')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADD_CAPA') {
        $input = $action['input'];
        foreach ($state['findings'] as &$f) {
            if ($f['id'] === $input['findingId']) {
                $capa = [
                    'id' => 'capa-' . edms_now_ms(),
                    'kind' => $input['kind'],
                    'description' => $input['description'],
                    'owner' => $input['owner'],
                    'dueDate' => $input['dueDate'],
                    'status' => 'in_progress',
                ];
                $f['capa'][] = $capa;
                if ($f['status'] === 'open' || $f['status'] === 'root_cause_analysis') {
                    $f['status'] = 'capa_in_progress';
                }
            }
        }
        unset($f);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'create', 'Capa', $input['findingId'], 'Menambahkan tindakan ' . ($input['kind'] === 'corrective' ? 'koreksi' : 'preventif'))],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'COMPLETE_CAPA') {
        $now = edms_today();
        foreach ($state['findings'] as &$f) {
            if ($f['id'] === $action['findingId']) {
                foreach ($f['capa'] as &$c) {
                    if ($c['id'] === $action['capaId']) {
                        $c['status'] = 'completed';
                        $c['completedAt'] = $now;
                    }
                }
                unset($c);
            }
        }
        unset($f);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'status_change', 'Capa', $action['capaId'], 'Menandai CAPA selesai')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADD_VERIFICATION') {
        foreach ($state['findings'] as &$f) {
            if ($f['id'] === $action['findingId']) {
                $v = array_merge(['id' => 'ver-' . edms_now_ms()], $action['verification']);
                array_unshift($f['verifications'], $v);
                if (!empty($v['effective'])) $f['status'] = 'verification';
            }
        }
        unset($f);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'view', 'Finding', $action['findingId'], 'Verifikasi efektivitas: ' . (empty($action['verification']['effective']) ? 'belum efektif' : 'efektif'))],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'CLOSE_FINDING') {
        $now = edms_today();
        $title = '';
        foreach ($state['findings'] as &$f) {
            if ($f['id'] === $action['findingId']) {
                $title = $f['title'];
                $f['status'] = 'closed';
                $f['closedAt'] = $now;
                $f['closureNote'] = $action['closureNote'];
            }
        }
        unset($f);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'status_change', 'Finding', $action['findingId'], 'Menutup temuan "' . $title . '"')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'UPDATE_FINDING_STATUS') {
        foreach ($state['findings'] as &$f) {
            if ($f['id'] === $action['findingId']) $f['status'] = $action['status'];
        }
        unset($f);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'status_change', 'Finding', $action['findingId'], 'Status temuan → ' . $action['status'])],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'SET_ROOT_CAUSE') {
        foreach ($state['findings'] as &$f) {
            if ($f['id'] === $action['findingId']) {
                $f['rootCause'] = $action['rootCause'];
                if ($f['status'] === 'open') $f['status'] = 'root_cause_analysis';
            }
        }
        unset($f);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'view', 'Finding', $action['findingId'], 'Menambahkan akar masalah (root cause)')],
            $state['auditLog'],
        );
        return $state;
    }

    // -----------------------------------------------------------------
    // Management review
    // -----------------------------------------------------------------
    if ($type === 'CREATE_MGMT_REVIEW') {
        $input = $action['input'];
        $now = edms_today();
        $inputs = [];
        foreach (($input['inputs'] ?? []) as $i => $it) {
            $inputs[] = array_merge($it, ['id' => 'mri-' . edms_now_ms() . '-' . $i]);
        }
        $review = [
            'id' => 'mr-' . edms_now_ms(),
            'code' => edms_next_code_for($state['mgmtReviews'] ?? [], 'MR'),
            'title' => $input['title'],
            'meetingDate' => $input['meetingDate'],
            'standards' => $input['standards'] ?? [],
            'chairperson' => $input['chairperson'],
            'attendees' => $input['attendees'] ?? [],
            'status' => 'scheduled',
            'agenda' => $input['agenda'] ?? '',
            'inputs' => $inputs,
            'decisions' => [],
            'actionItems' => [],
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
        $state['mgmtReviews'] = array_merge([$review], $state['mgmtReviews'] ?? []);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'create', 'ManagementReview', $review['id'], 'Menjadwalkan tinjauan manajemen "' . $review['title'] . '" (' . $review['code'] . ')')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADD_MGMT_DECISION') {
        $now = edms_today();
        foreach ($state['mgmtReviews'] as &$r) {
            if ($r['id'] === $action['reviewId']) {
                $r['decisions'][] = array_merge(['id' => 'mrd-' . edms_now_ms()], $action['decision']);
                $r['status'] = 'held';
                $r['updatedAt'] = $now;
            }
        }
        unset($r);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'create', 'MgmtDecision', $action['reviewId'], 'Mencatat keputusan tinjauan manajemen')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADD_MGMT_ACTION') {
        $now = edms_today();
        foreach ($state['mgmtReviews'] as &$r) {
            if ($r['id'] === $action['reviewId']) {
                $r['actionItems'][] = array_merge($action['item'], ['id' => 'mra-' . edms_now_ms(), 'status' => 'open']);
                $r['updatedAt'] = $now;
            }
        }
        unset($r);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'create', 'MgmtAction', $action['reviewId'], 'Menambahkan tindak lanjut tinjauan manajemen')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'CLOSE_MGMT_ACTION') {
        $now = edms_today();
        foreach ($state['mgmtReviews'] as &$r) {
            if ($r['id'] === $action['reviewId']) {
                foreach ($r['actionItems'] as &$it) {
                    if ($it['id'] === $action['itemId']) {
                        $it['status'] = 'completed';
                        $it['completedAt'] = $now;
                        $it['closureNote'] = $action['closureNote'] ?? '';
                    }
                }
                unset($it);
                $r['updatedAt'] = $now;
            }
        }
        unset($r);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'status_change', 'MgmtAction', $action['itemId'], 'Menutup tindak lanjut tinjauan manajemen')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'UPDATE_MGMT_REVIEW_STATUS') {
        $now = edms_today();
        foreach ($state['mgmtReviews'] as &$r) {
            if ($r['id'] === $action['reviewId']) {
                $r['status'] = $action['status'];
                $r['updatedAt'] = $now;
            }
        }
        unset($r);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'status_change', 'ManagementReview', $action['reviewId'], 'Status tinjauan manajemen → ' . $action['status'])],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'ADD_GAP_FOLLOWUP') {
        $input = $action['input'];
        $followUp = [
            'id' => 'gf-' . edms_now_ms(),
            'gapId' => $input['gapId'],
            'type' => $input['type'],
            'pic' => $input['pic'],
            'deadline' => $input['deadline'],
            'action' => $input['action'],
            'reviewer' => $input['reviewer'],
            'status' => 'open',
            'createdAt' => edms_today(),
            'createdBy' => $action['actor'],
        ];
        array_unshift($state['gapFollowUps'], $followUp);
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'create', 'GapFollowUp', $followUp['id'], 'Menambahkan tindak lanjut gap (PIC: ' . $followUp['pic'] . ')')],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'UPDATE_GAP_FOLLOWUP_STATUS') {
        $found = false;
        foreach ($state['gapFollowUps'] as &$gf) {
            if ($gf['id'] === $action['followUpId']) {
                $found = true;
                $gf['status'] = $action['status'];
                if ($action['status'] === 'closed') {
                    $gf['closedAt'] = edms_today();
                } else {
                    unset($gf['closedAt']);
                }
            }
        }
        unset($gf);
        if (!$found) return $state;
        $state['auditLog'] = array_merge(
            [edms_make_audit($action['actor'], 'status_change', 'GapFollowUp', $action['followUpId'], 'Status tindak lanjut gap → ' . $action['status'])],
            $state['auditLog'],
        );
        return $state;
    }

    if ($type === 'RESET_DEMO_DATA') {
        return edms_initial_state();
    }

    return $state;
}
