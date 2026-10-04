import numpy as np
from scipy import sparse

from src.types.numeric_array_type import FloatMatrix


def solve_implicit_factors_for_rows(
    confidence_matrix: sparse.csr_matrix,
    fixed_factors: FloatMatrix,
    regularization: float,
) -> FloatMatrix:
    factor_count = fixed_factors.shape[1]
    gram_matrix = fixed_factors.T @ fixed_factors
    solved_factors = np.zeros((confidence_matrix.shape[0], factor_count))
    identity = np.eye(factor_count)
    for row_index in range(confidence_matrix.shape[0]):
        start, end = confidence_matrix.indptr[row_index], confidence_matrix.indptr[row_index + 1]
        if start == end:
            continue
        column_indices = confidence_matrix.indices[start:end]
        confidences = confidence_matrix.data[start:end]
        interacted_factors = fixed_factors[column_indices]
        left_side = (
            gram_matrix + (interacted_factors.T * (confidences - 1.0)) @ interacted_factors + regularization * identity
        )
        right_side = (interacted_factors.T * confidences).sum(axis=1)
        solved_factors[row_index] = np.linalg.solve(left_side, right_side)
    return solved_factors


def train_implicit_alternating_least_squares(
    interaction_matrix: sparse.csr_matrix,
    factor_count: int = 16,
    regularization: float = 0.1,
    confidence_scale: float = 10.0,
    iteration_count: int = 8,
    seed: int = 0,
) -> tuple[FloatMatrix, FloatMatrix]:
    random_generator = np.random.default_rng(seed)
    user_count, item_count = interaction_matrix.shape
    confidence_by_user = interaction_matrix.copy().astype(np.float64)
    confidence_by_user.data = 1.0 + confidence_scale * np.log1p(confidence_by_user.data)
    confidence_by_item = confidence_by_user.T.tocsr()
    user_factors = random_generator.normal(0, 0.01, (user_count, factor_count))
    item_factors = random_generator.normal(0, 0.01, (item_count, factor_count))
    for _iteration in range(iteration_count):
        user_factors = solve_implicit_factors_for_rows(confidence_by_user, item_factors, regularization)
        item_factors = solve_implicit_factors_for_rows(confidence_by_item, user_factors, regularization)
    return user_factors, item_factors


def calculate_row_cosine_similarity(factors: FloatMatrix) -> FloatMatrix:
    norms = np.linalg.norm(factors, axis=1, keepdims=True)
    normalized = factors / np.where(norms == 0, 1.0, norms)
    return normalized @ normalized.T


def calculate_item_cooccurrence_cosine(binary_interactions: sparse.csr_matrix) -> sparse.csr_matrix:
    cooccurrence = (binary_interactions.T @ binary_interactions).tocsr().astype(np.float64)
    item_counts = np.asarray(binary_interactions.sum(axis=0)).ravel().astype(np.float64)
    inverse_norms = 1.0 / np.sqrt(np.where(item_counts == 0, 1.0, item_counts))
    scaled = sparse.diags(inverse_norms) @ cooccurrence @ sparse.diags(inverse_norms)
    scaled = scaled.tocsr()
    scaled.setdiag(0.0)
    scaled.eliminate_zeros()
    return scaled
