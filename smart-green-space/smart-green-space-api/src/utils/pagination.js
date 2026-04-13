function getPagination({ page = 1, limit = 20 }) {
  const safePage = Number.isFinite(page) ? Number(page) : 1;
  const safeLimit = Number.isFinite(limit) ? Number(limit) : 20;
  const normalizedPage = Math.max(1, safePage);
  const normalizedLimit = Math.min(100, Math.max(1, safeLimit));

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
    take: normalizedLimit,
  };
}

function buildPaginatedResponse({ items, total, page, limit }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

module.exports = { getPagination, buildPaginatedResponse };
