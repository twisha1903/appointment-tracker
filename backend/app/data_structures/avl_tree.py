"""Self-Balancing Augmented AVL Interval Tree for Appointment Scheduling & Conflict Detection.

ADS Syllabus Reference:
- Unit 3: Trees — Self-Balancing AVL Trees, Rotations (LL, RR, LR, RL),
  Augmented Interval Trees with Subtree Max End-Time Tracking.

Theoretical Complexity:
- Search:
    O(log n) time by compound key (start_at, appointment_id).
- Insertion:
    O(log n) time, with bottom-up height & max_end_at maintenance and O(1) rotation rebalancing.
- Deletion:
    O(log n) time, with in-order successor substitution and bottom-up AVL rebalancing.
- Chronological In-Order Traversal:
    O(n) time, yielding appointments in strict chronological sequence.
- Interval Overlap Conflict Detection:
    O(k * log n) or O(log n + k) expected time (where k is the number of reported conflicts),
    pruning subtrees using left.max_end_at and right subtree boundary checks.
- Space Complexity:
    O(n) nodes where each node stores height and augmented max_end_at.
"""

from typing import Any, Dict, List, Optional, Tuple


class AVLNode:
    """Explicit node in the Augmented AVL Interval Tree."""

    def __init__(
        self,
        appointment_id: str,
        patient_id: str,
        doctor_id: str,
        start_at: str,
        end_at: str,
        status: str,
        data: Any,
    ):
        # Compound key ensures total ordering even when appointments start at the exact same second
        self.key: Tuple[str, str] = (start_at, appointment_id)
        self.start_at: str = start_at
        self.end_at: str = end_at
        self.appointment_id: str = appointment_id
        self.patient_id: str = patient_id
        self.doctor_id: str = doctor_id
        self.status: str = status
        self.data: Any = data

        self.height: int = 1
        self.max_end_at: str = end_at
        self.left: Optional[AVLNode] = None
        self.right: Optional[AVLNode] = None

    def __repr__(self) -> str:
        return (
            f"AVLNode({self.appointment_id}, {self.start_at}..{self.end_at}, "
            f"dr={self.doctor_id}, pt={self.patient_id}, h={self.height}, max={self.max_end_at})"
        )


class AppointmentAVLTree:
    """Self-balancing Augmented AVL Interval Tree.

    Maintains appointments in chronological order while augmenting each node with
    max_end_at (the maximum end time in its subtree). Enables O(log n + k) interval
    conflict detection to block overlapping bookings for the same doctor OR same patient.
    """

    def __init__(self):
        self.root: Optional[AVLNode] = None
        self._size: int = 0

    # --- Node Helpers & Metadata Maintenance ---

    def get_height(self, node: Optional[AVLNode]) -> int:
        """Return node height or 0 if None."""
        return node.height if node else 0

    def get_balance(self, node: Optional[AVLNode]) -> int:
        """Return balance factor (height(left) - height(right))."""
        if not node:
            return 0
        return self.get_height(node.left) - self.get_height(node.right)

    def _update_node_metadata(self, node: AVLNode) -> None:
        """Recompute node height and augmented max_end_at from child subtrees."""
        left_h = self.get_height(node.left)
        right_h = self.get_height(node.right)
        node.height = 1 + max(left_h, right_h)

        max_val = node.end_at
        if node.left and node.left.max_end_at > max_val:
            max_val = node.left.max_end_at
        if node.right and node.right.max_end_at > max_val:
            max_val = node.right.max_end_at
        node.max_end_at = max_val

    # --- Rebalancing Rotations ---

    def _rotate_right(self, y: AVLNode) -> AVLNode:
        """Right rotation around y:

              y                x
             / \\              / \\
            x   T3   -->     T1  y
           / \\                  / \\
          T1  T2               T2  T3
        """
        x = y.left
        if not x:
            return y
        t2 = x.right

        # Perform rotation
        x.right = y
        y.left = t2

        # Update metadata: rotated child first, then new root
        self._update_node_metadata(y)
        self._update_node_metadata(x)
        return x

    def _rotate_left(self, x: AVLNode) -> AVLNode:
        """Left rotation around x:

            x                  y
           / \\                / \\
          T1  y      -->     x   T3
             / \\            / \\
            T2  T3         T1  T2
        """
        y = x.right
        if not y:
            return x
        t2 = y.left

        # Perform rotation
        y.left = x
        x.right = t2

        # Update metadata: rotated child first, then new root
        self._update_node_metadata(x)
        self._update_node_metadata(y)
        return y

    def _rebalance(self, node: AVLNode) -> AVLNode:
        """Calculate balance factor and execute LL, RR, LR, or RL rotations if needed."""
        self._update_node_metadata(node)
        balance = self.get_balance(node)

        # Case 1: Left Heavy (balance > 1)
        if balance > 1 and node.left:
            # LR Case: left child is right heavy
            if self.get_balance(node.left) < 0:
                node.left = self._rotate_left(node.left)
            # LL Case (or LR converted to LL)
            return self._rotate_right(node)

        # Case 2: Right Heavy (balance < -1)
        if balance < -1 and node.right:
            # RL Case: right child is left heavy
            if self.get_balance(node.right) > 0:
                node.right = self._rotate_right(node.right)
            # RR Case (or RL converted to RR)
            return self._rotate_left(node)

        return node

    # --- Core Operations: Insert, Delete, Search ---

    def insert(self, appointment: Any) -> None:
        """Insert or update an appointment in the AVL tree."""
        if isinstance(appointment, dict):
            apt_id = appointment["appointment_id"]
            pt_id = appointment["patient_id"]
            dr_id = appointment["doctor_id"]
            s_at = appointment["start_at"]
            e_at = appointment["end_at"]
            st = appointment.get("status", "Scheduled")
        else:
            apt_id = appointment.appointment_id
            pt_id = appointment.patient_id
            dr_id = appointment.doctor_id
            s_at = appointment.start_at
            e_at = appointment.end_at
            st = appointment.status

        new_node = AVLNode(
            appointment_id=apt_id,
            patient_id=pt_id,
            doctor_id=dr_id,
            start_at=s_at,
            end_at=e_at,
            status=st,
            data=appointment,
        )

        inserted_flag = [False]

        def _insert(node: Optional[AVLNode]) -> AVLNode:
            if not node:
                inserted_flag[0] = True
                return new_node

            if new_node.key < node.key:
                node.left = _insert(node.left)
            elif new_node.key > node.key:
                node.right = _insert(node.right)
            else:
                # Key already exists: update record in place
                node.start_at = s_at
                node.end_at = e_at
                node.patient_id = pt_id
                node.doctor_id = dr_id
                node.status = st
                node.data = appointment
                self._update_node_metadata(node)
                return node

            return self._rebalance(node)

        self.root = _insert(self.root)
        if inserted_flag[0]:
            self._size += 1

    def _min_value_node(self, node: AVLNode) -> AVLNode:
        """Find the in-order successor (minimum node in subtree)."""
        current = node
        while current.left is not None:
            current = current.left
        return current

    def delete(self, start_at: str, appointment_id: str) -> bool:
        """Delete an appointment by compound key (start_at, appointment_id)."""
        target_key = (start_at, appointment_id)
        deleted_flag = [False]

        def _delete(node: Optional[AVLNode]) -> Optional[AVLNode]:
            if not node:
                return None

            if target_key < node.key:
                node.left = _delete(node.left)
            elif target_key > node.key:
                node.right = _delete(node.right)
            else:
                # Node found
                deleted_flag[0] = True
                # Case 1: Node with 0 or 1 child
                if node.left is None:
                    return node.right
                elif node.right is None:
                    return node.left

                # Case 2: Node with 2 children
                # Get the in-order successor (smallest in the right subtree)
                successor = self._min_value_node(node.right)
                # Copy successor's data and key to this node
                node.key = successor.key
                node.start_at = successor.start_at
                node.end_at = successor.end_at
                node.appointment_id = successor.appointment_id
                node.patient_id = successor.patient_id
                node.doctor_id = successor.doctor_id
                node.status = successor.status
                node.data = successor.data

                # Delete the in-order successor from the right subtree
                target_successor_key = successor.key
                def _delete_succ(r_node: Optional[AVLNode]) -> Optional[AVLNode]:
                    if not r_node:
                        return None
                    if target_successor_key < r_node.key:
                        r_node.left = _delete_succ(r_node.left)
                    elif target_successor_key > r_node.key:
                        r_node.right = _delete_succ(r_node.right)
                    else:
                        return r_node.right
                    return self._rebalance(r_node)

                node.right = _delete_succ(node.right)

            return self._rebalance(node)

        self.root = _delete(self.root)
        if deleted_flag[0]:
            self._size -= 1
        return deleted_flag[0]

    def search(self, start_at: str, appointment_id: str) -> Optional[Any]:
        """Search for appointment data by compound key in O(log n) time."""
        target_key = (start_at, appointment_id)
        current = self.root
        while current:
            if target_key == current.key:
                return current.data
            elif target_key < current.key:
                current = current.left
            else:
                current = current.right
        return None

    def in_order_traversal(self, date_prefix: Optional[str] = None) -> List[Any]:
        """Perform in-order traversal returning appointments in chronological order.

        Optionally filters to appointments starting on a specific date (YYYY-MM-DD).
        """
        results: List[Any] = []

        def _traverse(node: Optional[AVLNode]):
            if not node:
                return
            _traverse(node.left)
            if date_prefix is None or node.start_at.startswith(date_prefix):
                results.append(node.data)
            _traverse(node.right)

        _traverse(self.root)
        return results

    # --- Interval Overlap Conflict Detection ---

    def find_conflicts(
        self,
        start_at: str,
        end_at: str,
        doctor_id: str,
        patient_id: str,
        exclude_appointment_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search for conflicting appointments using augmented interval tree properties.

        Conflict Condition:
        Two appointments overlap if and only if:
            existing.start_at < new.end_at AND new.start_at < existing.end_at
        AND they involve the same doctor OR the same patient (non-cancelled).

        Pruning:
        1. Left subtree is pruned if left.max_end_at <= start_at (no interval in left can extend past start_at).
        2. Right subtree is pruned if node.start_at >= end_at (all intervals in right start on or after node.start_at >= end_at).
        """
        conflicts: List[Dict[str, Any]] = []

        def _search_conflicts(node: Optional[AVLNode]):
            if not node:
                return

            # 1. Pruning Left Subtree:
            # If left subtree exists and its max_end_at is greater than start_at, intervals inside may overlap
            if node.left and node.left.max_end_at > start_at:
                _search_conflicts(node.left)

            # 2. Check current node
            is_excluded = (exclude_appointment_id and node.appointment_id == exclude_appointment_id)
            is_cancelled = (node.status == "Cancelled")

            if not is_excluded and not is_cancelled:
                # Interval overlap test: [start_at, end_at) and [node.start_at, node.end_at)
                if node.start_at < end_at and start_at < node.end_at:
                    doctor_match = (node.doctor_id == doctor_id)
                    patient_match = (node.patient_id == patient_id)

                    if doctor_match or patient_match:
                        conflict_type = (
                            "both" if doctor_match and patient_match
                            else ("doctor" if doctor_match else "patient")
                        )
                        conflicts.append({
                            "conflicting_appointment_id": node.appointment_id,
                            "conflict_type": conflict_type,
                            "start_at": node.start_at,
                            "end_at": node.end_at,
                            "doctor_id": node.doctor_id,
                            "patient_id": node.patient_id,
                            "status": node.status,
                            "appointment": node.data,
                        })

            # 3. Pruning Right Subtree:
            # Only recurse into right subtree if node.start_at < end_at
            if node.start_at < end_at:
                _search_conflicts(node.right)

        _search_conflicts(self.root)
        return conflicts

    # --- Tree Invariant Verification & Diagnostics ---

    def verify_invariants(self) -> bool:
        """Recursively assert that balance factor, BST order, height, and max_end_at hold for all nodes."""
        def _check(node: Optional[AVLNode]) -> Tuple[int, str]:
            if not node:
                return 0, ""

            # Check left subtree BST order
            if node.left:
                assert node.left.key < node.key, f"BST violation: {node.left.key} >= {node.key}"
            # Check right subtree BST order
            if node.right:
                assert node.right.key > node.key, f"BST violation: {node.right.key} <= {node.key}"

            left_h, left_max = _check(node.left)
            right_h, right_max = _check(node.right)

            # Check height calculation
            expected_h = 1 + max(left_h, right_h)
            assert node.height == expected_h, f"Height mismatch at {node.key}: expected {expected_h}, got {node.height}"

            # Check balance factor
            balance = left_h - right_h
            assert abs(balance) <= 1, f"AVL balance factor violation at {node.key}: balance={balance}"

            # Check max_end_at augmentation
            expected_max = node.end_at
            if left_max > expected_max:
                expected_max = left_max
            if right_max > expected_max:
                expected_max = right_max
            assert node.max_end_at == expected_max, (
                f"Augmented max_end_at mismatch at {node.key}: expected {expected_max}, got {node.max_end_at}"
            )

            return node.height, node.max_end_at

        _check(self.root)
        return True

    def clear(self) -> None:
        """Reset the AVL tree to empty state."""
        self.root = None
        self._size = 0

    def __len__(self) -> int:
        return self._size

    def get_stats(self) -> dict:
        """Return tree metrics for viva telemetry."""
        return {
            "size": self._size,
            "root_height": self.get_height(self.root),
            "root_balance": self.get_balance(self.root),
            "max_end_at": self.root.max_end_at if self.root else "",
        }
