; =============================================================================
; LGSS SCUM Server Manager — Win64 Indirect Jump-Slot ABI Reference (MASM x64)
; Copyright (c) 2026 Legendary Gaming (4UR3X).
;
; Illustrates zero-overhead x64 register-preserving indirect tail-jumps used in
; clean-room Win64 system proxy thunks without shadow-space stack mutation.
; =============================================================================

OPTION CASEMAP:NONE

EXTERN g_UpstreamDispatchTable : QWORD

.CODE

; Macro: DEFINE_TAIL_THUNK
; Preserves RCX, RDX, R8, R9, XMM0-XMM3, and caller shadow space [RSP+8..RSP+28h]
; across direct RIP-relative indirect jumps on Windows x64 ABI.
DEFINE_TAIL_THUNK MACRO ExportSymbol:REQ, SlotIndex:REQ
    ALIGN 16
    PUBLIC ExportSymbol
    ExportSymbol PROC
        jmp QWORD PTR [g_UpstreamDispatchTable + (SlotIndex * 8)]
    ExportSymbol ENDP
ENDM

; Sample ABI verification thunks (slots 0..7)
DEFINE_TAIL_THUNK LgssAbiThunkSlot00, 0
DEFINE_TAIL_THUNK LgssAbiThunkSlot01, 1
DEFINE_TAIL_THUNK LgssAbiThunkSlot02, 2
DEFINE_TAIL_THUNK LgssAbiThunkSlot03, 3
DEFINE_TAIL_THUNK LgssAbiThunkSlot04, 4
DEFINE_TAIL_THUNK LgssAbiThunkSlot05, 5
DEFINE_TAIL_THUNK LgssAbiThunkSlot06, 6
DEFINE_TAIL_THUNK LgssAbiThunkSlot07, 7

; Fast atomic readiness probe (returns 1 in EAX when dispatch slot 0 is bound)
ALIGN 16
PUBLIC LgssIsDispatchTableBound
LgssIsDispatchTableBound PROC
    mov rax, QWORD PTR [g_UpstreamDispatchTable]
    test rax, rax
    setnz al
    movzx eax, al
    ret
LgssIsDispatchTableBound ENDP

END
; LGSS Platform Release v1.3.35
