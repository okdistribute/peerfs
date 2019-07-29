module.exports = function uniq (array) {
  if (!Array.isArray(array)) array = [array]
  return Array.from(new Set(array))
}
