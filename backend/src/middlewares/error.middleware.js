const errorHandler = (err, req, res, next) => {
  console.error('API Error:', err);

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const target = err.meta?.target ? err.meta.target : 'field';
    return res.status(409).json({
      success: false,
      message: `Conflict: A record with this unique ${target} already exists.`,
      code: 'P2002',
    });
  }

  // Explicit status code on custom error
  if (err.statusCode || err.status) {
    return res.status(err.statusCode || err.status).json({
      success: false,
      message: err.message || 'Operation failed',
      errors: err.errors || undefined,
    });
  }

  return res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};

module.exports = errorHandler;
