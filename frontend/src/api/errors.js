// 화면 전체가 쓰는 API 에러. error.code로 안내 문구를 고른다 (client.js에서 다시 내보냄)
export class ApiError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}
