!(function (t, r) {
	'object' == typeof exports && 'object' == typeof module
		? (module.exports = r())
		: 'function' == typeof define && define.amd
		? define([], r)
		: 'object' == typeof exports
		? (exports.thalesData = r())
		: (t.thalesData = r());
})(window, function () {
	return (function (t) {
		var r = {};
		function i(e) {
			if (r[e]) return r[e].exports;
			var n = (r[e] = { i: e, l: !1, exports: {} });
			return t[e].call(n.exports, n, n.exports, i), (n.l = !0), n.exports;
		}
		return (
			(i.m = t),
			(i.c = r),
			(i.d = function (t, r, e) {
				i.o(t, r) || Object.defineProperty(t, r, { enumerable: !0, get: e });
			}),
			(i.r = function (t) {
				'undefined' != typeof Symbol &&
					Symbol.toStringTag &&
					Object.defineProperty(t, Symbol.toStringTag, { value: 'Module' }),
					Object.defineProperty(t, '__esModule', { value: !0 });
			}),
			(i.t = function (t, r) {
				if ((1 & r && (t = i(t)), 8 & r)) return t;
				if (4 & r && 'object' == typeof t && t && t.__esModule) return t;
				var e = Object.create(null);
				if (
					(i.r(e),
					Object.defineProperty(e, 'default', { enumerable: !0, value: t }),
					2 & r && 'string' != typeof t)
				)
					for (var n in t)
						i.d(
							e,
							n,
							function (r) {
								return t[r];
							}.bind(null, n)
						);
				return e;
			}),
			(i.n = function (t) {
				var r =
					t && t.__esModule
						? function () {
								return t.default;
						  }
						: function () {
								return t;
						  };
				return i.d(r, 'a', r), r;
			}),
			(i.o = function (t, r) {
				return Object.prototype.hasOwnProperty.call(t, r);
			}),
			(i.p = ''),
			i((i.s = 19))
		);
	})([
		function (t, r) {
			t.exports = function (t) {
				return (
					t.webpackPolyfill ||
						((t.deprecate = function () {}),
						(t.paths = []),
						t.children || (t.children = []),
						Object.defineProperty(t, 'loaded', {
							enumerable: !0,
							get: function () {
								return t.l;
							},
						}),
						Object.defineProperty(t, 'id', {
							enumerable: !0,
							get: function () {
								return t.i;
							},
						}),
						(t.webpackPolyfill = 1)),
					t
				);
			};
		},
		function (t, r, i) {
			'use strict';
			(function (t) {
				/*!
				 * The buffer module from node.js, for the browser.
				 *
				 * @author   Feross Aboukhadijeh <http://feross.org>
				 * @license  MIT
				 */
				var e = i(22),
					n = i(23),
					o = i(24);
				function s() {
					return u.TYPED_ARRAY_SUPPORT ? 2147483647 : 1073741823;
				}
				function h(t, r) {
					if (s() < r) throw new RangeError('Invalid typed array length');
					return (
						u.TYPED_ARRAY_SUPPORT
							? ((t = new Uint8Array(r)).__proto__ = u.prototype)
							: (null === t && (t = new u(r)), (t.length = r)),
						t
					);
				}
				function u(t, r, i) {
					if (!(u.TYPED_ARRAY_SUPPORT || this instanceof u)) return new u(t, r, i);
					if ('number' == typeof t) {
						if ('string' == typeof r)
							throw new Error('If encoding is specified then the first argument must be a string');
						return f(this, t);
					}
					return a(this, t, r, i);
				}
				function a(t, r, i, e) {
					if ('number' == typeof r) throw new TypeError('"value" argument must not be a number');
					return 'undefined' != typeof ArrayBuffer && r instanceof ArrayBuffer
						? (function (t, r, i, e) {
								if ((r.byteLength, i < 0 || r.byteLength < i))
									throw new RangeError("'offset' is out of bounds");
								if (r.byteLength < i + (e || 0)) throw new RangeError("'length' is out of bounds");
								r =
									void 0 === i && void 0 === e
										? new Uint8Array(r)
										: void 0 === e
										? new Uint8Array(r, i)
										: new Uint8Array(r, i, e);
								u.TYPED_ARRAY_SUPPORT ? ((t = r).__proto__ = u.prototype) : (t = m(t, r));
								return t;
						  })(t, r, i, e)
						: 'string' == typeof r
						? (function (t, r, i) {
								('string' == typeof i && '' !== i) || (i = 'utf8');
								if (!u.isEncoding(i))
									throw new TypeError('"encoding" must be a valid string encoding');
								var e = 0 | d(r, i),
									n = (t = h(t, e)).write(r, i);
								n !== e && (t = t.slice(0, n));
								return t;
						  })(t, r, i)
						: (function (t, r) {
								if (u.isBuffer(r)) {
									var i = 0 | c(r.length);
									return 0 === (t = h(t, i)).length || r.copy(t, 0, 0, i), t;
								}
								if (r) {
									if (
										('undefined' != typeof ArrayBuffer && r.buffer instanceof ArrayBuffer) ||
										'length' in r
									)
										return 'number' != typeof r.length || (e = r.length) != e ? h(t, 0) : m(t, r);
									if ('Buffer' === r.type && o(r.data)) return m(t, r.data);
								}
								var e;
								throw new TypeError(
									'First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.'
								);
						  })(t, r);
				}
				function l(t) {
					if ('number' != typeof t) throw new TypeError('"size" argument must be a number');
					if (t < 0) throw new RangeError('"size" argument must not be negative');
				}
				function f(t, r) {
					if ((l(r), (t = h(t, r < 0 ? 0 : 0 | c(r))), !u.TYPED_ARRAY_SUPPORT))
						for (var i = 0; i < r; ++i) t[i] = 0;
					return t;
				}
				function m(t, r) {
					var i = r.length < 0 ? 0 : 0 | c(r.length);
					t = h(t, i);
					for (var e = 0; e < i; e += 1) t[e] = 255 & r[e];
					return t;
				}
				function c(t) {
					if (t >= s())
						throw new RangeError(
							'Attempt to allocate Buffer larger than maximum size: 0x' +
								s().toString(16) +
								' bytes'
						);
					return 0 | t;
				}
				function d(t, r) {
					if (u.isBuffer(t)) return t.length;
					if (
						'undefined' != typeof ArrayBuffer &&
						'function' == typeof ArrayBuffer.isView &&
						(ArrayBuffer.isView(t) || t instanceof ArrayBuffer)
					)
						return t.byteLength;
					'string' != typeof t && (t = '' + t);
					var i = t.length;
					if (0 === i) return 0;
					for (var e = !1; ; )
						switch (r) {
							case 'ascii':
							case 'latin1':
							case 'binary':
								return i;
							case 'utf8':
							case 'utf-8':
							case void 0:
								return D(t).length;
							case 'ucs2':
							case 'ucs-2':
							case 'utf16le':
							case 'utf-16le':
								return 2 * i;
							case 'hex':
								return i >>> 1;
							case 'base64':
								return Z(t).length;
							default:
								if (e) return D(t).length;
								(r = ('' + r).toLowerCase()), (e = !0);
						}
				}
				function p(t, r, i) {
					var e = !1;
					if (((void 0 === r || r < 0) && (r = 0), r > this.length)) return '';
					if (((void 0 === i || i > this.length) && (i = this.length), i <= 0)) return '';
					if ((i >>>= 0) <= (r >>>= 0)) return '';
					for (t || (t = 'utf8'); ; )
						switch (t) {
							case 'hex':
								return R(this, r, i);
							case 'utf8':
							case 'utf-8':
								return S(this, r, i);
							case 'ascii':
								return N(this, r, i);
							case 'latin1':
							case 'binary':
								return T(this, r, i);
							case 'base64':
								return x(this, r, i);
							case 'ucs2':
							case 'ucs-2':
							case 'utf16le':
							case 'utf-16le':
								return k(this, r, i);
							default:
								if (e) throw new TypeError('Unknown encoding: ' + t);
								(t = (t + '').toLowerCase()), (e = !0);
						}
				}
				function g(t, r, i) {
					var e = t[r];
					(t[r] = t[i]), (t[i] = e);
				}
				function v(t, r, i, e, n) {
					if (0 === t.length) return -1;
					if (
						('string' == typeof i
							? ((e = i), (i = 0))
							: i > 2147483647
							? (i = 2147483647)
							: i < -2147483648 && (i = -2147483648),
						(i = +i),
						isNaN(i) && (i = n ? 0 : t.length - 1),
						i < 0 && (i = t.length + i),
						i >= t.length)
					) {
						if (n) return -1;
						i = t.length - 1;
					} else if (i < 0) {
						if (!n) return -1;
						i = 0;
					}
					if (('string' == typeof r && (r = u.from(r, e)), u.isBuffer(r)))
						return 0 === r.length ? -1 : y(t, r, i, e, n);
					if ('number' == typeof r)
						return (
							(r &= 255),
							u.TYPED_ARRAY_SUPPORT && 'function' == typeof Uint8Array.prototype.indexOf
								? n
									? Uint8Array.prototype.indexOf.call(t, r, i)
									: Uint8Array.prototype.lastIndexOf.call(t, r, i)
								: y(t, [r], i, e, n)
						);
					throw new TypeError('val must be string, number or Buffer');
				}
				function y(t, r, i, e, n) {
					var o,
						s = 1,
						h = t.length,
						u = r.length;
					if (
						void 0 !== e &&
						('ucs2' === (e = String(e).toLowerCase()) ||
							'ucs-2' === e ||
							'utf16le' === e ||
							'utf-16le' === e)
					) {
						if (t.length < 2 || r.length < 2) return -1;
						(s = 2), (h /= 2), (u /= 2), (i /= 2);
					}
					function a(t, r) {
						return 1 === s ? t[r] : t.readUInt16BE(r * s);
					}
					if (n) {
						var l = -1;
						for (o = i; o < h; o++)
							if (a(t, o) === a(r, -1 === l ? 0 : o - l)) {
								if ((-1 === l && (l = o), o - l + 1 === u)) return l * s;
							} else -1 !== l && (o -= o - l), (l = -1);
					} else
						for (i + u > h && (i = h - u), o = i; o >= 0; o--) {
							for (var f = !0, m = 0; m < u; m++)
								if (a(t, o + m) !== a(r, m)) {
									f = !1;
									break;
								}
							if (f) return o;
						}
					return -1;
				}
				function w(t, r, i, e) {
					i = Number(i) || 0;
					var n = t.length - i;
					e ? (e = Number(e)) > n && (e = n) : (e = n);
					var o = r.length;
					if (o % 2 != 0) throw new TypeError('Invalid hex string');
					e > o / 2 && (e = o / 2);
					for (var s = 0; s < e; ++s) {
						var h = parseInt(r.substr(2 * s, 2), 16);
						if (isNaN(h)) return s;
						t[i + s] = h;
					}
					return s;
				}
				function M(t, r, i, e) {
					return z(D(r, t.length - i), t, i, e);
				}
				function b(t, r, i, e) {
					return z(
						(function (t) {
							for (var r = [], i = 0; i < t.length; ++i) r.push(255 & t.charCodeAt(i));
							return r;
						})(r),
						t,
						i,
						e
					);
				}
				function _(t, r, i, e) {
					return b(t, r, i, e);
				}
				function A(t, r, i, e) {
					return z(Z(r), t, i, e);
				}
				function E(t, r, i, e) {
					return z(
						(function (t, r) {
							for (var i, e, n, o = [], s = 0; s < t.length && !((r -= 2) < 0); ++s)
								(i = t.charCodeAt(s)), (e = i >> 8), (n = i % 256), o.push(n), o.push(e);
							return o;
						})(r, t.length - i),
						t,
						i,
						e
					);
				}
				function x(t, r, i) {
					return 0 === r && i === t.length ? e.fromByteArray(t) : e.fromByteArray(t.slice(r, i));
				}
				function S(t, r, i) {
					i = Math.min(t.length, i);
					for (var e = [], n = r; n < i; ) {
						var o,
							s,
							h,
							u,
							a = t[n],
							l = null,
							f = a > 239 ? 4 : a > 223 ? 3 : a > 191 ? 2 : 1;
						if (n + f <= i)
							switch (f) {
								case 1:
									a < 128 && (l = a);
									break;
								case 2:
									128 == (192 & (o = t[n + 1])) &&
										(u = ((31 & a) << 6) | (63 & o)) > 127 &&
										(l = u);
									break;
								case 3:
									(o = t[n + 1]),
										(s = t[n + 2]),
										128 == (192 & o) &&
											128 == (192 & s) &&
											(u = ((15 & a) << 12) | ((63 & o) << 6) | (63 & s)) > 2047 &&
											(u < 55296 || u > 57343) &&
											(l = u);
									break;
								case 4:
									(o = t[n + 1]),
										(s = t[n + 2]),
										(h = t[n + 3]),
										128 == (192 & o) &&
											128 == (192 & s) &&
											128 == (192 & h) &&
											(u = ((15 & a) << 18) | ((63 & o) << 12) | ((63 & s) << 6) | (63 & h)) >
												65535 &&
											u < 1114112 &&
											(l = u);
							}
						null === l
							? ((l = 65533), (f = 1))
							: l > 65535 &&
							  ((l -= 65536), e.push(((l >>> 10) & 1023) | 55296), (l = 56320 | (1023 & l))),
							e.push(l),
							(n += f);
					}
					return (function (t) {
						var r = t.length;
						if (r <= 4096) return String.fromCharCode.apply(String, t);
						var i = '',
							e = 0;
						for (; e < r; ) i += String.fromCharCode.apply(String, t.slice(e, (e += 4096)));
						return i;
					})(e);
				}
				(r.Buffer = u),
					(r.SlowBuffer = function (t) {
						+t != t && (t = 0);
						return u.alloc(+t);
					}),
					(r.INSPECT_MAX_BYTES = 50),
					(u.TYPED_ARRAY_SUPPORT =
						void 0 !== t.TYPED_ARRAY_SUPPORT
							? t.TYPED_ARRAY_SUPPORT
							: (function () {
									try {
										var t = new Uint8Array(1);
										return (
											(t.__proto__ = {
												__proto__: Uint8Array.prototype,
												foo: function () {
													return 42;
												},
											}),
											42 === t.foo() &&
												'function' == typeof t.subarray &&
												0 === t.subarray(1, 1).byteLength
										);
									} catch (t) {
										return !1;
									}
							  })()),
					(r.kMaxLength = s()),
					(u.poolSize = 8192),
					(u._augment = function (t) {
						return (t.__proto__ = u.prototype), t;
					}),
					(u.from = function (t, r, i) {
						return a(null, t, r, i);
					}),
					u.TYPED_ARRAY_SUPPORT &&
						((u.prototype.__proto__ = Uint8Array.prototype),
						(u.__proto__ = Uint8Array),
						'undefined' != typeof Symbol &&
							Symbol.species &&
							u[Symbol.species] === u &&
							Object.defineProperty(u, Symbol.species, { value: null, configurable: !0 })),
					(u.alloc = function (t, r, i) {
						return (function (t, r, i, e) {
							return (
								l(r),
								r <= 0
									? h(t, r)
									: void 0 !== i
									? 'string' == typeof e
										? h(t, r).fill(i, e)
										: h(t, r).fill(i)
									: h(t, r)
							);
						})(null, t, r, i);
					}),
					(u.allocUnsafe = function (t) {
						return f(null, t);
					}),
					(u.allocUnsafeSlow = function (t) {
						return f(null, t);
					}),
					(u.isBuffer = function (t) {
						return !(null == t || !t._isBuffer);
					}),
					(u.compare = function (t, r) {
						if (!u.isBuffer(t) || !u.isBuffer(r)) throw new TypeError('Arguments must be Buffers');
						if (t === r) return 0;
						for (var i = t.length, e = r.length, n = 0, o = Math.min(i, e); n < o; ++n)
							if (t[n] !== r[n]) {
								(i = t[n]), (e = r[n]);
								break;
							}
						return i < e ? -1 : e < i ? 1 : 0;
					}),
					(u.isEncoding = function (t) {
						switch (String(t).toLowerCase()) {
							case 'hex':
							case 'utf8':
							case 'utf-8':
							case 'ascii':
							case 'latin1':
							case 'binary':
							case 'base64':
							case 'ucs2':
							case 'ucs-2':
							case 'utf16le':
							case 'utf-16le':
								return !0;
							default:
								return !1;
						}
					}),
					(u.concat = function (t, r) {
						if (!o(t)) throw new TypeError('"list" argument must be an Array of Buffers');
						if (0 === t.length) return u.alloc(0);
						var i;
						if (void 0 === r) for (r = 0, i = 0; i < t.length; ++i) r += t[i].length;
						var e = u.allocUnsafe(r),
							n = 0;
						for (i = 0; i < t.length; ++i) {
							var s = t[i];
							if (!u.isBuffer(s))
								throw new TypeError('"list" argument must be an Array of Buffers');
							s.copy(e, n), (n += s.length);
						}
						return e;
					}),
					(u.byteLength = d),
					(u.prototype._isBuffer = !0),
					(u.prototype.swap16 = function () {
						var t = this.length;
						if (t % 2 != 0) throw new RangeError('Buffer size must be a multiple of 16-bits');
						for (var r = 0; r < t; r += 2) g(this, r, r + 1);
						return this;
					}),
					(u.prototype.swap32 = function () {
						var t = this.length;
						if (t % 4 != 0) throw new RangeError('Buffer size must be a multiple of 32-bits');
						for (var r = 0; r < t; r += 4) g(this, r, r + 3), g(this, r + 1, r + 2);
						return this;
					}),
					(u.prototype.swap64 = function () {
						var t = this.length;
						if (t % 8 != 0) throw new RangeError('Buffer size must be a multiple of 64-bits');
						for (var r = 0; r < t; r += 8)
							g(this, r, r + 7),
								g(this, r + 1, r + 6),
								g(this, r + 2, r + 5),
								g(this, r + 3, r + 4);
						return this;
					}),
					(u.prototype.toString = function () {
						var t = 0 | this.length;
						return 0 === t ? '' : 0 === arguments.length ? S(this, 0, t) : p.apply(this, arguments);
					}),
					(u.prototype.equals = function (t) {
						if (!u.isBuffer(t)) throw new TypeError('Argument must be a Buffer');
						return this === t || 0 === u.compare(this, t);
					}),
					(u.prototype.inspect = function () {
						var t = '',
							i = r.INSPECT_MAX_BYTES;
						return (
							this.length > 0 &&
								((t = this.toString('hex', 0, i).match(/.{2}/g).join(' ')),
								this.length > i && (t += ' ... ')),
							'<Buffer ' + t + '>'
						);
					}),
					(u.prototype.compare = function (t, r, i, e, n) {
						if (!u.isBuffer(t)) throw new TypeError('Argument must be a Buffer');
						if (
							(void 0 === r && (r = 0),
							void 0 === i && (i = t ? t.length : 0),
							void 0 === e && (e = 0),
							void 0 === n && (n = this.length),
							r < 0 || i > t.length || e < 0 || n > this.length)
						)
							throw new RangeError('out of range index');
						if (e >= n && r >= i) return 0;
						if (e >= n) return -1;
						if (r >= i) return 1;
						if (this === t) return 0;
						for (
							var o = (n >>>= 0) - (e >>>= 0),
								s = (i >>>= 0) - (r >>>= 0),
								h = Math.min(o, s),
								a = this.slice(e, n),
								l = t.slice(r, i),
								f = 0;
							f < h;
							++f
						)
							if (a[f] !== l[f]) {
								(o = a[f]), (s = l[f]);
								break;
							}
						return o < s ? -1 : s < o ? 1 : 0;
					}),
					(u.prototype.includes = function (t, r, i) {
						return -1 !== this.indexOf(t, r, i);
					}),
					(u.prototype.indexOf = function (t, r, i) {
						return v(this, t, r, i, !0);
					}),
					(u.prototype.lastIndexOf = function (t, r, i) {
						return v(this, t, r, i, !1);
					}),
					(u.prototype.write = function (t, r, i, e) {
						if (void 0 === r) (e = 'utf8'), (i = this.length), (r = 0);
						else if (void 0 === i && 'string' == typeof r) (e = r), (i = this.length), (r = 0);
						else {
							if (!isFinite(r))
								throw new Error(
									'Buffer.write(string, encoding, offset[, length]) is no longer supported'
								);
							(r |= 0),
								isFinite(i) ? ((i |= 0), void 0 === e && (e = 'utf8')) : ((e = i), (i = void 0));
						}
						var n = this.length - r;
						if (
							((void 0 === i || i > n) && (i = n),
							(t.length > 0 && (i < 0 || r < 0)) || r > this.length)
						)
							throw new RangeError('Attempt to write outside buffer bounds');
						e || (e = 'utf8');
						for (var o = !1; ; )
							switch (e) {
								case 'hex':
									return w(this, t, r, i);
								case 'utf8':
								case 'utf-8':
									return M(this, t, r, i);
								case 'ascii':
									return b(this, t, r, i);
								case 'latin1':
								case 'binary':
									return _(this, t, r, i);
								case 'base64':
									return A(this, t, r, i);
								case 'ucs2':
								case 'ucs-2':
								case 'utf16le':
								case 'utf-16le':
									return E(this, t, r, i);
								default:
									if (o) throw new TypeError('Unknown encoding: ' + e);
									(e = ('' + e).toLowerCase()), (o = !0);
							}
					}),
					(u.prototype.toJSON = function () {
						return { type: 'Buffer', data: Array.prototype.slice.call(this._arr || this, 0) };
					});
				function N(t, r, i) {
					var e = '';
					i = Math.min(t.length, i);
					for (var n = r; n < i; ++n) e += String.fromCharCode(127 & t[n]);
					return e;
				}
				function T(t, r, i) {
					var e = '';
					i = Math.min(t.length, i);
					for (var n = r; n < i; ++n) e += String.fromCharCode(t[n]);
					return e;
				}
				function R(t, r, i) {
					var e = t.length;
					(!r || r < 0) && (r = 0), (!i || i < 0 || i > e) && (i = e);
					for (var n = '', o = r; o < i; ++o) n += F(t[o]);
					return n;
				}
				function k(t, r, i) {
					for (var e = t.slice(r, i), n = '', o = 0; o < e.length; o += 2)
						n += String.fromCharCode(e[o] + 256 * e[o + 1]);
					return n;
				}
				function I(t, r, i) {
					if (t % 1 != 0 || t < 0) throw new RangeError('offset is not uint');
					if (t + r > i) throw new RangeError('Trying to access beyond buffer length');
				}
				function B(t, r, i, e, n, o) {
					if (!u.isBuffer(t)) throw new TypeError('"buffer" argument must be a Buffer instance');
					if (r > n || r < o) throw new RangeError('"value" argument is out of bounds');
					if (i + e > t.length) throw new RangeError('Index out of range');
				}
				function O(t, r, i, e) {
					r < 0 && (r = 65535 + r + 1);
					for (var n = 0, o = Math.min(t.length - i, 2); n < o; ++n)
						t[i + n] = (r & (255 << (8 * (e ? n : 1 - n)))) >>> (8 * (e ? n : 1 - n));
				}
				function C(t, r, i, e) {
					r < 0 && (r = 4294967295 + r + 1);
					for (var n = 0, o = Math.min(t.length - i, 4); n < o; ++n)
						t[i + n] = (r >>> (8 * (e ? n : 3 - n))) & 255;
				}
				function L(t, r, i, e, n, o) {
					if (i + e > t.length) throw new RangeError('Index out of range');
					if (i < 0) throw new RangeError('Index out of range');
				}
				function j(t, r, i, e, o) {
					return o || L(t, 0, i, 4), n.write(t, r, i, e, 23, 4), i + 4;
				}
				function P(t, r, i, e, o) {
					return o || L(t, 0, i, 8), n.write(t, r, i, e, 52, 8), i + 8;
				}
				(u.prototype.slice = function (t, r) {
					var i,
						e = this.length;
					if (
						((t = ~~t) < 0 ? (t += e) < 0 && (t = 0) : t > e && (t = e),
						(r = void 0 === r ? e : ~~r) < 0 ? (r += e) < 0 && (r = 0) : r > e && (r = e),
						r < t && (r = t),
						u.TYPED_ARRAY_SUPPORT)
					)
						(i = this.subarray(t, r)).__proto__ = u.prototype;
					else {
						var n = r - t;
						i = new u(n, void 0);
						for (var o = 0; o < n; ++o) i[o] = this[o + t];
					}
					return i;
				}),
					(u.prototype.readUIntLE = function (t, r, i) {
						(t |= 0), (r |= 0), i || I(t, r, this.length);
						for (var e = this[t], n = 1, o = 0; ++o < r && (n *= 256); ) e += this[t + o] * n;
						return e;
					}),
					(u.prototype.readUIntBE = function (t, r, i) {
						(t |= 0), (r |= 0), i || I(t, r, this.length);
						for (var e = this[t + --r], n = 1; r > 0 && (n *= 256); ) e += this[t + --r] * n;
						return e;
					}),
					(u.prototype.readUInt8 = function (t, r) {
						return r || I(t, 1, this.length), this[t];
					}),
					(u.prototype.readUInt16LE = function (t, r) {
						return r || I(t, 2, this.length), this[t] | (this[t + 1] << 8);
					}),
					(u.prototype.readUInt16BE = function (t, r) {
						return r || I(t, 2, this.length), (this[t] << 8) | this[t + 1];
					}),
					(u.prototype.readUInt32LE = function (t, r) {
						return (
							r || I(t, 4, this.length),
							(this[t] | (this[t + 1] << 8) | (this[t + 2] << 16)) + 16777216 * this[t + 3]
						);
					}),
					(u.prototype.readUInt32BE = function (t, r) {
						return (
							r || I(t, 4, this.length),
							16777216 * this[t] + ((this[t + 1] << 16) | (this[t + 2] << 8) | this[t + 3])
						);
					}),
					(u.prototype.readIntLE = function (t, r, i) {
						(t |= 0), (r |= 0), i || I(t, r, this.length);
						for (var e = this[t], n = 1, o = 0; ++o < r && (n *= 256); ) e += this[t + o] * n;
						return e >= (n *= 128) && (e -= Math.pow(2, 8 * r)), e;
					}),
					(u.prototype.readIntBE = function (t, r, i) {
						(t |= 0), (r |= 0), i || I(t, r, this.length);
						for (var e = r, n = 1, o = this[t + --e]; e > 0 && (n *= 256); ) o += this[t + --e] * n;
						return o >= (n *= 128) && (o -= Math.pow(2, 8 * r)), o;
					}),
					(u.prototype.readInt8 = function (t, r) {
						return r || I(t, 1, this.length), 128 & this[t] ? -1 * (255 - this[t] + 1) : this[t];
					}),
					(u.prototype.readInt16LE = function (t, r) {
						r || I(t, 2, this.length);
						var i = this[t] | (this[t + 1] << 8);
						return 32768 & i ? 4294901760 | i : i;
					}),
					(u.prototype.readInt16BE = function (t, r) {
						r || I(t, 2, this.length);
						var i = this[t + 1] | (this[t] << 8);
						return 32768 & i ? 4294901760 | i : i;
					}),
					(u.prototype.readInt32LE = function (t, r) {
						return (
							r || I(t, 4, this.length),
							this[t] | (this[t + 1] << 8) | (this[t + 2] << 16) | (this[t + 3] << 24)
						);
					}),
					(u.prototype.readInt32BE = function (t, r) {
						return (
							r || I(t, 4, this.length),
							(this[t] << 24) | (this[t + 1] << 16) | (this[t + 2] << 8) | this[t + 3]
						);
					}),
					(u.prototype.readFloatLE = function (t, r) {
						return r || I(t, 4, this.length), n.read(this, t, !0, 23, 4);
					}),
					(u.prototype.readFloatBE = function (t, r) {
						return r || I(t, 4, this.length), n.read(this, t, !1, 23, 4);
					}),
					(u.prototype.readDoubleLE = function (t, r) {
						return r || I(t, 8, this.length), n.read(this, t, !0, 52, 8);
					}),
					(u.prototype.readDoubleBE = function (t, r) {
						return r || I(t, 8, this.length), n.read(this, t, !1, 52, 8);
					}),
					(u.prototype.writeUIntLE = function (t, r, i, e) {
						((t = +t), (r |= 0), (i |= 0), e) || B(this, t, r, i, Math.pow(2, 8 * i) - 1, 0);
						var n = 1,
							o = 0;
						for (this[r] = 255 & t; ++o < i && (n *= 256); ) this[r + o] = (t / n) & 255;
						return r + i;
					}),
					(u.prototype.writeUIntBE = function (t, r, i, e) {
						((t = +t), (r |= 0), (i |= 0), e) || B(this, t, r, i, Math.pow(2, 8 * i) - 1, 0);
						var n = i - 1,
							o = 1;
						for (this[r + n] = 255 & t; --n >= 0 && (o *= 256); ) this[r + n] = (t / o) & 255;
						return r + i;
					}),
					(u.prototype.writeUInt8 = function (t, r, i) {
						return (
							(t = +t),
							(r |= 0),
							i || B(this, t, r, 1, 255, 0),
							u.TYPED_ARRAY_SUPPORT || (t = Math.floor(t)),
							(this[r] = 255 & t),
							r + 1
						);
					}),
					(u.prototype.writeUInt16LE = function (t, r, i) {
						return (
							(t = +t),
							(r |= 0),
							i || B(this, t, r, 2, 65535, 0),
							u.TYPED_ARRAY_SUPPORT
								? ((this[r] = 255 & t), (this[r + 1] = t >>> 8))
								: O(this, t, r, !0),
							r + 2
						);
					}),
					(u.prototype.writeUInt16BE = function (t, r, i) {
						return (
							(t = +t),
							(r |= 0),
							i || B(this, t, r, 2, 65535, 0),
							u.TYPED_ARRAY_SUPPORT
								? ((this[r] = t >>> 8), (this[r + 1] = 255 & t))
								: O(this, t, r, !1),
							r + 2
						);
					}),
					(u.prototype.writeUInt32LE = function (t, r, i) {
						return (
							(t = +t),
							(r |= 0),
							i || B(this, t, r, 4, 4294967295, 0),
							u.TYPED_ARRAY_SUPPORT
								? ((this[r + 3] = t >>> 24),
								  (this[r + 2] = t >>> 16),
								  (this[r + 1] = t >>> 8),
								  (this[r] = 255 & t))
								: C(this, t, r, !0),
							r + 4
						);
					}),
					(u.prototype.writeUInt32BE = function (t, r, i) {
						return (
							(t = +t),
							(r |= 0),
							i || B(this, t, r, 4, 4294967295, 0),
							u.TYPED_ARRAY_SUPPORT
								? ((this[r] = t >>> 24),
								  (this[r + 1] = t >>> 16),
								  (this[r + 2] = t >>> 8),
								  (this[r + 3] = 255 & t))
								: C(this, t, r, !1),
							r + 4
						);
					}),
					(u.prototype.writeIntLE = function (t, r, i, e) {
						if (((t = +t), (r |= 0), !e)) {
							var n = Math.pow(2, 8 * i - 1);
							B(this, t, r, i, n - 1, -n);
						}
						var o = 0,
							s = 1,
							h = 0;
						for (this[r] = 255 & t; ++o < i && (s *= 256); )
							t < 0 && 0 === h && 0 !== this[r + o - 1] && (h = 1),
								(this[r + o] = (((t / s) >> 0) - h) & 255);
						return r + i;
					}),
					(u.prototype.writeIntBE = function (t, r, i, e) {
						if (((t = +t), (r |= 0), !e)) {
							var n = Math.pow(2, 8 * i - 1);
							B(this, t, r, i, n - 1, -n);
						}
						var o = i - 1,
							s = 1,
							h = 0;
						for (this[r + o] = 255 & t; --o >= 0 && (s *= 256); )
							t < 0 && 0 === h && 0 !== this[r + o + 1] && (h = 1),
								(this[r + o] = (((t / s) >> 0) - h) & 255);
						return r + i;
					}),
					(u.prototype.writeInt8 = function (t, r, i) {
						return (
							(t = +t),
							(r |= 0),
							i || B(this, t, r, 1, 127, -128),
							u.TYPED_ARRAY_SUPPORT || (t = Math.floor(t)),
							t < 0 && (t = 255 + t + 1),
							(this[r] = 255 & t),
							r + 1
						);
					}),
					(u.prototype.writeInt16LE = function (t, r, i) {
						return (
							(t = +t),
							(r |= 0),
							i || B(this, t, r, 2, 32767, -32768),
							u.TYPED_ARRAY_SUPPORT
								? ((this[r] = 255 & t), (this[r + 1] = t >>> 8))
								: O(this, t, r, !0),
							r + 2
						);
					}),
					(u.prototype.writeInt16BE = function (t, r, i) {
						return (
							(t = +t),
							(r |= 0),
							i || B(this, t, r, 2, 32767, -32768),
							u.TYPED_ARRAY_SUPPORT
								? ((this[r] = t >>> 8), (this[r + 1] = 255 & t))
								: O(this, t, r, !1),
							r + 2
						);
					}),
					(u.prototype.writeInt32LE = function (t, r, i) {
						return (
							(t = +t),
							(r |= 0),
							i || B(this, t, r, 4, 2147483647, -2147483648),
							u.TYPED_ARRAY_SUPPORT
								? ((this[r] = 255 & t),
								  (this[r + 1] = t >>> 8),
								  (this[r + 2] = t >>> 16),
								  (this[r + 3] = t >>> 24))
								: C(this, t, r, !0),
							r + 4
						);
					}),
					(u.prototype.writeInt32BE = function (t, r, i) {
						return (
							(t = +t),
							(r |= 0),
							i || B(this, t, r, 4, 2147483647, -2147483648),
							t < 0 && (t = 4294967295 + t + 1),
							u.TYPED_ARRAY_SUPPORT
								? ((this[r] = t >>> 24),
								  (this[r + 1] = t >>> 16),
								  (this[r + 2] = t >>> 8),
								  (this[r + 3] = 255 & t))
								: C(this, t, r, !1),
							r + 4
						);
					}),
					(u.prototype.writeFloatLE = function (t, r, i) {
						return j(this, t, r, !0, i);
					}),
					(u.prototype.writeFloatBE = function (t, r, i) {
						return j(this, t, r, !1, i);
					}),
					(u.prototype.writeDoubleLE = function (t, r, i) {
						return P(this, t, r, !0, i);
					}),
					(u.prototype.writeDoubleBE = function (t, r, i) {
						return P(this, t, r, !1, i);
					}),
					(u.prototype.copy = function (t, r, i, e) {
						if (
							(i || (i = 0),
							e || 0 === e || (e = this.length),
							r >= t.length && (r = t.length),
							r || (r = 0),
							e > 0 && e < i && (e = i),
							e === i)
						)
							return 0;
						if (0 === t.length || 0 === this.length) return 0;
						if (r < 0) throw new RangeError('targetStart out of bounds');
						if (i < 0 || i >= this.length) throw new RangeError('sourceStart out of bounds');
						if (e < 0) throw new RangeError('sourceEnd out of bounds');
						e > this.length && (e = this.length), t.length - r < e - i && (e = t.length - r + i);
						var n,
							o = e - i;
						if (this === t && i < r && r < e) for (n = o - 1; n >= 0; --n) t[n + r] = this[n + i];
						else if (o < 1e3 || !u.TYPED_ARRAY_SUPPORT)
							for (n = 0; n < o; ++n) t[n + r] = this[n + i];
						else Uint8Array.prototype.set.call(t, this.subarray(i, i + o), r);
						return o;
					}),
					(u.prototype.fill = function (t, r, i, e) {
						if ('string' == typeof t) {
							if (
								('string' == typeof r
									? ((e = r), (r = 0), (i = this.length))
									: 'string' == typeof i && ((e = i), (i = this.length)),
								1 === t.length)
							) {
								var n = t.charCodeAt(0);
								n < 256 && (t = n);
							}
							if (void 0 !== e && 'string' != typeof e)
								throw new TypeError('encoding must be a string');
							if ('string' == typeof e && !u.isEncoding(e))
								throw new TypeError('Unknown encoding: ' + e);
						} else 'number' == typeof t && (t &= 255);
						if (r < 0 || this.length < r || this.length < i)
							throw new RangeError('Out of range index');
						if (i <= r) return this;
						var o;
						if (
							((r >>>= 0),
							(i = void 0 === i ? this.length : i >>> 0),
							t || (t = 0),
							'number' == typeof t)
						)
							for (o = r; o < i; ++o) this[o] = t;
						else {
							var s = u.isBuffer(t) ? t : D(new u(t, e).toString()),
								h = s.length;
							for (o = 0; o < i - r; ++o) this[o + r] = s[o % h];
						}
						return this;
					});
				var U = /[^+\/0-9A-Za-z-_]/g;
				function F(t) {
					return t < 16 ? '0' + t.toString(16) : t.toString(16);
				}
				function D(t, r) {
					var i;
					r = r || 1 / 0;
					for (var e = t.length, n = null, o = [], s = 0; s < e; ++s) {
						if ((i = t.charCodeAt(s)) > 55295 && i < 57344) {
							if (!n) {
								if (i > 56319) {
									(r -= 3) > -1 && o.push(239, 191, 189);
									continue;
								}
								if (s + 1 === e) {
									(r -= 3) > -1 && o.push(239, 191, 189);
									continue;
								}
								n = i;
								continue;
							}
							if (i < 56320) {
								(r -= 3) > -1 && o.push(239, 191, 189), (n = i);
								continue;
							}
							i = 65536 + (((n - 55296) << 10) | (i - 56320));
						} else n && (r -= 3) > -1 && o.push(239, 191, 189);
						if (((n = null), i < 128)) {
							if ((r -= 1) < 0) break;
							o.push(i);
						} else if (i < 2048) {
							if ((r -= 2) < 0) break;
							o.push((i >> 6) | 192, (63 & i) | 128);
						} else if (i < 65536) {
							if ((r -= 3) < 0) break;
							o.push((i >> 12) | 224, ((i >> 6) & 63) | 128, (63 & i) | 128);
						} else {
							if (!(i < 1114112)) throw new Error('Invalid code point');
							if ((r -= 4) < 0) break;
							o.push(
								(i >> 18) | 240,
								((i >> 12) & 63) | 128,
								((i >> 6) & 63) | 128,
								(63 & i) | 128
							);
						}
					}
					return o;
				}
				function Z(t) {
					return e.toByteArray(
						(function (t) {
							if (
								(t = (function (t) {
									return t.trim ? t.trim() : t.replace(/^\s+|\s+$/g, '');
								})(t).replace(U, '')).length < 2
							)
								return '';
							for (; t.length % 4 != 0; ) t += '=';
							return t;
						})(t)
					);
				}
				function z(t, r, i, e) {
					for (var n = 0; n < e && !(n + i >= r.length || n >= t.length); ++n) r[n + i] = t[n];
					return n;
				}
			}.call(this, i(3)));
		},
		,
		function (t, r) {
			var i;
			i = (function () {
				return this;
			})();
			try {
				i = i || new Function('return this')();
			} catch (t) {
				'object' == typeof window && (i = window);
			}
			t.exports = i;
		},
		function (t, r, i) {
			(function (t, i) {
				var e;
				!(function () {
					var n =
							('object' == typeof self && self.self === self && self) ||
							('object' == typeof t && t.global === t && t) ||
							this ||
							{},
						o = n._,
						s = Array.prototype,
						h = Object.prototype,
						u = 'undefined' != typeof Symbol ? Symbol.prototype : null,
						a = s.push,
						l = s.slice,
						f = h.toString,
						m = h.hasOwnProperty,
						c = Array.isArray,
						d = Object.keys,
						p = Object.create,
						g = function () {},
						v = function (t) {
							return t instanceof v ? t : this instanceof v ? void (this._wrapped = t) : new v(t);
						};
					r.nodeType ? (n._ = v) : (!i.nodeType && i.exports && (r = i.exports = v), (r._ = v)),
						(v.VERSION = '1.9.1');
					var y,
						w = function (t, r, i) {
							if (void 0 === r) return t;
							switch (null == i ? 3 : i) {
								case 1:
									return function (i) {
										return t.call(r, i);
									};
								case 3:
									return function (i, e, n) {
										return t.call(r, i, e, n);
									};
								case 4:
									return function (i, e, n, o) {
										return t.call(r, i, e, n, o);
									};
							}
							return function () {
								return t.apply(r, arguments);
							};
						},
						M = function (t, r, i) {
							return v.iteratee !== y
								? v.iteratee(t, r)
								: null == t
								? v.identity
								: v.isFunction(t)
								? w(t, r, i)
								: v.isObject(t) && !v.isArray(t)
								? v.matcher(t)
								: v.property(t);
						};
					v.iteratee = y = function (t, r) {
						return M(t, r, 1 / 0);
					};
					var b = function (t, r) {
							return (
								(r = null == r ? t.length - 1 : +r),
								function () {
									for (var i = Math.max(arguments.length - r, 0), e = Array(i), n = 0; n < i; n++)
										e[n] = arguments[n + r];
									switch (r) {
										case 0:
											return t.call(this, e);
										case 1:
											return t.call(this, arguments[0], e);
										case 2:
											return t.call(this, arguments[0], arguments[1], e);
									}
									var o = Array(r + 1);
									for (n = 0; n < r; n++) o[n] = arguments[n];
									return (o[r] = e), t.apply(this, o);
								}
							);
						},
						_ = function (t) {
							if (!v.isObject(t)) return {};
							if (p) return p(t);
							g.prototype = t;
							var r = new g();
							return (g.prototype = null), r;
						},
						A = function (t) {
							return function (r) {
								return null == r ? void 0 : r[t];
							};
						},
						E = function (t, r) {
							return null != t && m.call(t, r);
						},
						x = function (t, r) {
							for (var i = r.length, e = 0; e < i; e++) {
								if (null == t) return;
								t = t[r[e]];
							}
							return i ? t : void 0;
						},
						S = Math.pow(2, 53) - 1,
						N = A('length'),
						T = function (t) {
							var r = N(t);
							return 'number' == typeof r && r >= 0 && r <= S;
						};
					(v.each = v.forEach =
						function (t, r, i) {
							var e, n;
							if (((r = w(r, i)), T(t))) for (e = 0, n = t.length; e < n; e++) r(t[e], e, t);
							else {
								var o = v.keys(t);
								for (e = 0, n = o.length; e < n; e++) r(t[o[e]], o[e], t);
							}
							return t;
						}),
						(v.map = v.collect =
							function (t, r, i) {
								r = M(r, i);
								for (
									var e = !T(t) && v.keys(t), n = (e || t).length, o = Array(n), s = 0;
									s < n;
									s++
								) {
									var h = e ? e[s] : s;
									o[s] = r(t[h], h, t);
								}
								return o;
							});
					var R = function (t) {
						var r = function (r, i, e, n) {
							var o = !T(r) && v.keys(r),
								s = (o || r).length,
								h = t > 0 ? 0 : s - 1;
							for (n || ((e = r[o ? o[h] : h]), (h += t)); h >= 0 && h < s; h += t) {
								var u = o ? o[h] : h;
								e = i(e, r[u], u, r);
							}
							return e;
						};
						return function (t, i, e, n) {
							var o = arguments.length >= 3;
							return r(t, w(i, n, 4), e, o);
						};
					};
					(v.reduce = v.foldl = v.inject = R(1)),
						(v.reduceRight = v.foldr = R(-1)),
						(v.find = v.detect =
							function (t, r, i) {
								var e = (T(t) ? v.findIndex : v.findKey)(t, r, i);
								if (void 0 !== e && -1 !== e) return t[e];
							}),
						(v.filter = v.select =
							function (t, r, i) {
								var e = [];
								return (
									(r = M(r, i)),
									v.each(t, function (t, i, n) {
										r(t, i, n) && e.push(t);
									}),
									e
								);
							}),
						(v.reject = function (t, r, i) {
							return v.filter(t, v.negate(M(r)), i);
						}),
						(v.every = v.all =
							function (t, r, i) {
								r = M(r, i);
								for (var e = !T(t) && v.keys(t), n = (e || t).length, o = 0; o < n; o++) {
									var s = e ? e[o] : o;
									if (!r(t[s], s, t)) return !1;
								}
								return !0;
							}),
						(v.some = v.any =
							function (t, r, i) {
								r = M(r, i);
								for (var e = !T(t) && v.keys(t), n = (e || t).length, o = 0; o < n; o++) {
									var s = e ? e[o] : o;
									if (r(t[s], s, t)) return !0;
								}
								return !1;
							}),
						(v.contains =
							v.includes =
							v.include =
								function (t, r, i, e) {
									return (
										T(t) || (t = v.values(t)),
										('number' != typeof i || e) && (i = 0),
										v.indexOf(t, r, i) >= 0
									);
								}),
						(v.invoke = b(function (t, r, i) {
							var e, n;
							return (
								v.isFunction(r)
									? (n = r)
									: v.isArray(r) && ((e = r.slice(0, -1)), (r = r[r.length - 1])),
								v.map(t, function (t) {
									var o = n;
									if (!o) {
										if ((e && e.length && (t = x(t, e)), null == t)) return;
										o = t[r];
									}
									return null == o ? o : o.apply(t, i);
								})
							);
						})),
						(v.pluck = function (t, r) {
							return v.map(t, v.property(r));
						}),
						(v.where = function (t, r) {
							return v.filter(t, v.matcher(r));
						}),
						(v.findWhere = function (t, r) {
							return v.find(t, v.matcher(r));
						}),
						(v.max = function (t, r, i) {
							var e,
								n,
								o = -1 / 0,
								s = -1 / 0;
							if (null == r || ('number' == typeof r && 'object' != typeof t[0] && null != t))
								for (var h = 0, u = (t = T(t) ? t : v.values(t)).length; h < u; h++)
									null != (e = t[h]) && e > o && (o = e);
							else
								(r = M(r, i)),
									v.each(t, function (t, i, e) {
										((n = r(t, i, e)) > s || (n === -1 / 0 && o === -1 / 0)) && ((o = t), (s = n));
									});
							return o;
						}),
						(v.min = function (t, r, i) {
							var e,
								n,
								o = 1 / 0,
								s = 1 / 0;
							if (null == r || ('number' == typeof r && 'object' != typeof t[0] && null != t))
								for (var h = 0, u = (t = T(t) ? t : v.values(t)).length; h < u; h++)
									null != (e = t[h]) && e < o && (o = e);
							else
								(r = M(r, i)),
									v.each(t, function (t, i, e) {
										((n = r(t, i, e)) < s || (n === 1 / 0 && o === 1 / 0)) && ((o = t), (s = n));
									});
							return o;
						}),
						(v.shuffle = function (t) {
							return v.sample(t, 1 / 0);
						}),
						(v.sample = function (t, r, i) {
							if (null == r || i) return T(t) || (t = v.values(t)), t[v.random(t.length - 1)];
							var e = T(t) ? v.clone(t) : v.values(t),
								n = N(e);
							r = Math.max(Math.min(r, n), 0);
							for (var o = n - 1, s = 0; s < r; s++) {
								var h = v.random(s, o),
									u = e[s];
								(e[s] = e[h]), (e[h] = u);
							}
							return e.slice(0, r);
						}),
						(v.sortBy = function (t, r, i) {
							var e = 0;
							return (
								(r = M(r, i)),
								v.pluck(
									v
										.map(t, function (t, i, n) {
											return { value: t, index: e++, criteria: r(t, i, n) };
										})
										.sort(function (t, r) {
											var i = t.criteria,
												e = r.criteria;
											if (i !== e) {
												if (i > e || void 0 === i) return 1;
												if (i < e || void 0 === e) return -1;
											}
											return t.index - r.index;
										}),
									'value'
								)
							);
						});
					var k = function (t, r) {
						return function (i, e, n) {
							var o = r ? [[], []] : {};
							return (
								(e = M(e, n)),
								v.each(i, function (r, n) {
									var s = e(r, n, i);
									t(o, r, s);
								}),
								o
							);
						};
					};
					(v.groupBy = k(function (t, r, i) {
						E(t, i) ? t[i].push(r) : (t[i] = [r]);
					})),
						(v.indexBy = k(function (t, r, i) {
							t[i] = r;
						})),
						(v.countBy = k(function (t, r, i) {
							E(t, i) ? t[i]++ : (t[i] = 1);
						}));
					var I = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
					(v.toArray = function (t) {
						return t
							? v.isArray(t)
								? l.call(t)
								: v.isString(t)
								? t.match(I)
								: T(t)
								? v.map(t, v.identity)
								: v.values(t)
							: [];
					}),
						(v.size = function (t) {
							return null == t ? 0 : T(t) ? t.length : v.keys(t).length;
						}),
						(v.partition = k(function (t, r, i) {
							t[i ? 0 : 1].push(r);
						}, !0)),
						(v.first =
							v.head =
							v.take =
								function (t, r, i) {
									return null == t || t.length < 1
										? null == r
											? void 0
											: []
										: null == r || i
										? t[0]
										: v.initial(t, t.length - r);
								}),
						(v.initial = function (t, r, i) {
							return l.call(t, 0, Math.max(0, t.length - (null == r || i ? 1 : r)));
						}),
						(v.last = function (t, r, i) {
							return null == t || t.length < 1
								? null == r
									? void 0
									: []
								: null == r || i
								? t[t.length - 1]
								: v.rest(t, Math.max(0, t.length - r));
						}),
						(v.rest =
							v.tail =
							v.drop =
								function (t, r, i) {
									return l.call(t, null == r || i ? 1 : r);
								}),
						(v.compact = function (t) {
							return v.filter(t, Boolean);
						});
					var B = function (t, r, i, e) {
						for (var n = (e = e || []).length, o = 0, s = N(t); o < s; o++) {
							var h = t[o];
							if (T(h) && (v.isArray(h) || v.isArguments(h)))
								if (r) for (var u = 0, a = h.length; u < a; ) e[n++] = h[u++];
								else B(h, r, i, e), (n = e.length);
							else i || (e[n++] = h);
						}
						return e;
					};
					(v.flatten = function (t, r) {
						return B(t, r, !1);
					}),
						(v.without = b(function (t, r) {
							return v.difference(t, r);
						})),
						(v.uniq = v.unique =
							function (t, r, i, e) {
								v.isBoolean(r) || ((e = i), (i = r), (r = !1)), null != i && (i = M(i, e));
								for (var n = [], o = [], s = 0, h = N(t); s < h; s++) {
									var u = t[s],
										a = i ? i(u, s, t) : u;
									r && !i
										? ((s && o === a) || n.push(u), (o = a))
										: i
										? v.contains(o, a) || (o.push(a), n.push(u))
										: v.contains(n, u) || n.push(u);
								}
								return n;
							}),
						(v.union = b(function (t) {
							return v.uniq(B(t, !0, !0));
						})),
						(v.intersection = function (t) {
							for (var r = [], i = arguments.length, e = 0, n = N(t); e < n; e++) {
								var o = t[e];
								if (!v.contains(r, o)) {
									var s;
									for (s = 1; s < i && v.contains(arguments[s], o); s++);
									s === i && r.push(o);
								}
							}
							return r;
						}),
						(v.difference = b(function (t, r) {
							return (
								(r = B(r, !0, !0)),
								v.filter(t, function (t) {
									return !v.contains(r, t);
								})
							);
						})),
						(v.unzip = function (t) {
							for (var r = (t && v.max(t, N).length) || 0, i = Array(r), e = 0; e < r; e++)
								i[e] = v.pluck(t, e);
							return i;
						}),
						(v.zip = b(v.unzip)),
						(v.object = function (t, r) {
							for (var i = {}, e = 0, n = N(t); e < n; e++)
								r ? (i[t[e]] = r[e]) : (i[t[e][0]] = t[e][1]);
							return i;
						});
					var O = function (t) {
						return function (r, i, e) {
							i = M(i, e);
							for (var n = N(r), o = t > 0 ? 0 : n - 1; o >= 0 && o < n; o += t)
								if (i(r[o], o, r)) return o;
							return -1;
						};
					};
					(v.findIndex = O(1)),
						(v.findLastIndex = O(-1)),
						(v.sortedIndex = function (t, r, i, e) {
							for (var n = (i = M(i, e, 1))(r), o = 0, s = N(t); o < s; ) {
								var h = Math.floor((o + s) / 2);
								i(t[h]) < n ? (o = h + 1) : (s = h);
							}
							return o;
						});
					var C = function (t, r, i) {
						return function (e, n, o) {
							var s = 0,
								h = N(e);
							if ('number' == typeof o)
								t > 0
									? (s = o >= 0 ? o : Math.max(o + h, s))
									: (h = o >= 0 ? Math.min(o + 1, h) : o + h + 1);
							else if (i && o && h) return e[(o = i(e, n))] === n ? o : -1;
							if (n != n) return (o = r(l.call(e, s, h), v.isNaN)) >= 0 ? o + s : -1;
							for (o = t > 0 ? s : h - 1; o >= 0 && o < h; o += t) if (e[o] === n) return o;
							return -1;
						};
					};
					(v.indexOf = C(1, v.findIndex, v.sortedIndex)),
						(v.lastIndexOf = C(-1, v.findLastIndex)),
						(v.range = function (t, r, i) {
							null == r && ((r = t || 0), (t = 0)), i || (i = r < t ? -1 : 1);
							for (
								var e = Math.max(Math.ceil((r - t) / i), 0), n = Array(e), o = 0;
								o < e;
								o++, t += i
							)
								n[o] = t;
							return n;
						}),
						(v.chunk = function (t, r) {
							if (null == r || r < 1) return [];
							for (var i = [], e = 0, n = t.length; e < n; ) i.push(l.call(t, e, (e += r)));
							return i;
						});
					var L = function (t, r, i, e, n) {
						if (!(e instanceof r)) return t.apply(i, n);
						var o = _(t.prototype),
							s = t.apply(o, n);
						return v.isObject(s) ? s : o;
					};
					(v.bind = b(function (t, r, i) {
						if (!v.isFunction(t)) throw new TypeError('Bind must be called on a function');
						var e = b(function (n) {
							return L(t, e, r, this, i.concat(n));
						});
						return e;
					})),
						(v.partial = b(function (t, r) {
							var i = v.partial.placeholder,
								e = function () {
									for (var n = 0, o = r.length, s = Array(o), h = 0; h < o; h++)
										s[h] = r[h] === i ? arguments[n++] : r[h];
									for (; n < arguments.length; ) s.push(arguments[n++]);
									return L(t, e, this, this, s);
								};
							return e;
						})),
						(v.partial.placeholder = v),
						(v.bindAll = b(function (t, r) {
							var i = (r = B(r, !1, !1)).length;
							if (i < 1) throw new Error('bindAll must be passed function names');
							for (; i--; ) {
								var e = r[i];
								t[e] = v.bind(t[e], t);
							}
						})),
						(v.memoize = function (t, r) {
							var i = function (e) {
								var n = i.cache,
									o = '' + (r ? r.apply(this, arguments) : e);
								return E(n, o) || (n[o] = t.apply(this, arguments)), n[o];
							};
							return (i.cache = {}), i;
						}),
						(v.delay = b(function (t, r, i) {
							return setTimeout(function () {
								return t.apply(null, i);
							}, r);
						})),
						(v.defer = v.partial(v.delay, v, 1)),
						(v.throttle = function (t, r, i) {
							var e,
								n,
								o,
								s,
								h = 0;
							i || (i = {});
							var u = function () {
									(h = !1 === i.leading ? 0 : v.now()),
										(e = null),
										(s = t.apply(n, o)),
										e || (n = o = null);
								},
								a = function () {
									var a = v.now();
									h || !1 !== i.leading || (h = a);
									var l = r - (a - h);
									return (
										(n = this),
										(o = arguments),
										l <= 0 || l > r
											? (e && (clearTimeout(e), (e = null)),
											  (h = a),
											  (s = t.apply(n, o)),
											  e || (n = o = null))
											: e || !1 === i.trailing || (e = setTimeout(u, l)),
										s
									);
								};
							return (
								(a.cancel = function () {
									clearTimeout(e), (h = 0), (e = n = o = null);
								}),
								a
							);
						}),
						(v.debounce = function (t, r, i) {
							var e,
								n,
								o = function (r, i) {
									(e = null), i && (n = t.apply(r, i));
								},
								s = b(function (s) {
									if ((e && clearTimeout(e), i)) {
										var h = !e;
										(e = setTimeout(o, r)), h && (n = t.apply(this, s));
									} else e = v.delay(o, r, this, s);
									return n;
								});
							return (
								(s.cancel = function () {
									clearTimeout(e), (e = null);
								}),
								s
							);
						}),
						(v.wrap = function (t, r) {
							return v.partial(r, t);
						}),
						(v.negate = function (t) {
							return function () {
								return !t.apply(this, arguments);
							};
						}),
						(v.compose = function () {
							var t = arguments,
								r = t.length - 1;
							return function () {
								for (var i = r, e = t[r].apply(this, arguments); i--; ) e = t[i].call(this, e);
								return e;
							};
						}),
						(v.after = function (t, r) {
							return function () {
								if (--t < 1) return r.apply(this, arguments);
							};
						}),
						(v.before = function (t, r) {
							var i;
							return function () {
								return --t > 0 && (i = r.apply(this, arguments)), t <= 1 && (r = null), i;
							};
						}),
						(v.once = v.partial(v.before, 2)),
						(v.restArguments = b);
					var j = !{ toString: null }.propertyIsEnumerable('toString'),
						P = [
							'valueOf',
							'isPrototypeOf',
							'toString',
							'propertyIsEnumerable',
							'hasOwnProperty',
							'toLocaleString',
						],
						U = function (t, r) {
							var i = P.length,
								e = t.constructor,
								n = (v.isFunction(e) && e.prototype) || h,
								o = 'constructor';
							for (E(t, o) && !v.contains(r, o) && r.push(o); i--; )
								(o = P[i]) in t && t[o] !== n[o] && !v.contains(r, o) && r.push(o);
						};
					(v.keys = function (t) {
						if (!v.isObject(t)) return [];
						if (d) return d(t);
						var r = [];
						for (var i in t) E(t, i) && r.push(i);
						return j && U(t, r), r;
					}),
						(v.allKeys = function (t) {
							if (!v.isObject(t)) return [];
							var r = [];
							for (var i in t) r.push(i);
							return j && U(t, r), r;
						}),
						(v.values = function (t) {
							for (var r = v.keys(t), i = r.length, e = Array(i), n = 0; n < i; n++) e[n] = t[r[n]];
							return e;
						}),
						(v.mapObject = function (t, r, i) {
							r = M(r, i);
							for (var e = v.keys(t), n = e.length, o = {}, s = 0; s < n; s++) {
								var h = e[s];
								o[h] = r(t[h], h, t);
							}
							return o;
						}),
						(v.pairs = function (t) {
							for (var r = v.keys(t), i = r.length, e = Array(i), n = 0; n < i; n++)
								e[n] = [r[n], t[r[n]]];
							return e;
						}),
						(v.invert = function (t) {
							for (var r = {}, i = v.keys(t), e = 0, n = i.length; e < n; e++) r[t[i[e]]] = i[e];
							return r;
						}),
						(v.functions = v.methods =
							function (t) {
								var r = [];
								for (var i in t) v.isFunction(t[i]) && r.push(i);
								return r.sort();
							});
					var F = function (t, r) {
						return function (i) {
							var e = arguments.length;
							if ((r && (i = Object(i)), e < 2 || null == i)) return i;
							for (var n = 1; n < e; n++)
								for (var o = arguments[n], s = t(o), h = s.length, u = 0; u < h; u++) {
									var a = s[u];
									(r && void 0 !== i[a]) || (i[a] = o[a]);
								}
							return i;
						};
					};
					(v.extend = F(v.allKeys)),
						(v.extendOwn = v.assign = F(v.keys)),
						(v.findKey = function (t, r, i) {
							r = M(r, i);
							for (var e, n = v.keys(t), o = 0, s = n.length; o < s; o++)
								if (r(t[(e = n[o])], e, t)) return e;
						});
					var D,
						Z,
						z = function (t, r, i) {
							return r in i;
						};
					(v.pick = b(function (t, r) {
						var i = {},
							e = r[0];
						if (null == t) return i;
						v.isFunction(e)
							? (r.length > 1 && (e = w(e, r[1])), (r = v.allKeys(t)))
							: ((e = z), (r = B(r, !1, !1)), (t = Object(t)));
						for (var n = 0, o = r.length; n < o; n++) {
							var s = r[n],
								h = t[s];
							e(h, s, t) && (i[s] = h);
						}
						return i;
					})),
						(v.omit = b(function (t, r) {
							var i,
								e = r[0];
							return (
								v.isFunction(e)
									? ((e = v.negate(e)), r.length > 1 && (i = r[1]))
									: ((r = v.map(B(r, !1, !1), String)),
									  (e = function (t, i) {
											return !v.contains(r, i);
									  })),
								v.pick(t, e, i)
							);
						})),
						(v.defaults = F(v.allKeys, !0)),
						(v.create = function (t, r) {
							var i = _(t);
							return r && v.extendOwn(i, r), i;
						}),
						(v.clone = function (t) {
							return v.isObject(t) ? (v.isArray(t) ? t.slice() : v.extend({}, t)) : t;
						}),
						(v.tap = function (t, r) {
							return r(t), t;
						}),
						(v.isMatch = function (t, r) {
							var i = v.keys(r),
								e = i.length;
							if (null == t) return !e;
							for (var n = Object(t), o = 0; o < e; o++) {
								var s = i[o];
								if (r[s] !== n[s] || !(s in n)) return !1;
							}
							return !0;
						}),
						(D = function (t, r, i, e) {
							if (t === r) return 0 !== t || 1 / t == 1 / r;
							if (null == t || null == r) return !1;
							if (t != t) return r != r;
							var n = typeof t;
							return ('function' === n || 'object' === n || 'object' == typeof r) && Z(t, r, i, e);
						}),
						(Z = function (t, r, i, e) {
							t instanceof v && (t = t._wrapped), r instanceof v && (r = r._wrapped);
							var n = f.call(t);
							if (n !== f.call(r)) return !1;
							switch (n) {
								case '[object RegExp]':
								case '[object String]':
									return '' + t == '' + r;
								case '[object Number]':
									return +t != +t ? +r != +r : 0 == +t ? 1 / +t == 1 / r : +t == +r;
								case '[object Date]':
								case '[object Boolean]':
									return +t == +r;
								case '[object Symbol]':
									return u.valueOf.call(t) === u.valueOf.call(r);
							}
							var o = '[object Array]' === n;
							if (!o) {
								if ('object' != typeof t || 'object' != typeof r) return !1;
								var s = t.constructor,
									h = r.constructor;
								if (
									s !== h &&
									!(v.isFunction(s) && s instanceof s && v.isFunction(h) && h instanceof h) &&
									'constructor' in t &&
									'constructor' in r
								)
									return !1;
							}
							e = e || [];
							for (var a = (i = i || []).length; a--; ) if (i[a] === t) return e[a] === r;
							if ((i.push(t), e.push(r), o)) {
								if ((a = t.length) !== r.length) return !1;
								for (; a--; ) if (!D(t[a], r[a], i, e)) return !1;
							} else {
								var l,
									m = v.keys(t);
								if (((a = m.length), v.keys(r).length !== a)) return !1;
								for (; a--; ) if (((l = m[a]), !E(r, l) || !D(t[l], r[l], i, e))) return !1;
							}
							return i.pop(), e.pop(), !0;
						}),
						(v.isEqual = function (t, r) {
							return D(t, r);
						}),
						(v.isEmpty = function (t) {
							return (
								null == t ||
								(T(t) && (v.isArray(t) || v.isString(t) || v.isArguments(t))
									? 0 === t.length
									: 0 === v.keys(t).length)
							);
						}),
						(v.isElement = function (t) {
							return !(!t || 1 !== t.nodeType);
						}),
						(v.isArray =
							c ||
							function (t) {
								return '[object Array]' === f.call(t);
							}),
						(v.isObject = function (t) {
							var r = typeof t;
							return 'function' === r || ('object' === r && !!t);
						}),
						v.each(
							[
								'Arguments',
								'Function',
								'String',
								'Number',
								'Date',
								'RegExp',
								'Error',
								'Symbol',
								'Map',
								'WeakMap',
								'Set',
								'WeakSet',
							],
							function (t) {
								v['is' + t] = function (r) {
									return f.call(r) === '[object ' + t + ']';
								};
							}
						),
						v.isArguments(arguments) ||
							(v.isArguments = function (t) {
								return E(t, 'callee');
							});
					var q = n.document && n.document.childNodes;
					'object' != typeof Int8Array &&
						'function' != typeof q &&
						(v.isFunction = function (t) {
							return 'function' == typeof t || !1;
						}),
						(v.isFinite = function (t) {
							return !v.isSymbol(t) && isFinite(t) && !isNaN(parseFloat(t));
						}),
						(v.isNaN = function (t) {
							return v.isNumber(t) && isNaN(t);
						}),
						(v.isBoolean = function (t) {
							return !0 === t || !1 === t || '[object Boolean]' === f.call(t);
						}),
						(v.isNull = function (t) {
							return null === t;
						}),
						(v.isUndefined = function (t) {
							return void 0 === t;
						}),
						(v.has = function (t, r) {
							if (!v.isArray(r)) return E(t, r);
							for (var i = r.length, e = 0; e < i; e++) {
								var n = r[e];
								if (null == t || !m.call(t, n)) return !1;
								t = t[n];
							}
							return !!i;
						}),
						(v.noConflict = function () {
							return (n._ = o), this;
						}),
						(v.identity = function (t) {
							return t;
						}),
						(v.constant = function (t) {
							return function () {
								return t;
							};
						}),
						(v.noop = function () {}),
						(v.property = function (t) {
							return v.isArray(t)
								? function (r) {
										return x(r, t);
								  }
								: A(t);
						}),
						(v.propertyOf = function (t) {
							return null == t
								? function () {}
								: function (r) {
										return v.isArray(r) ? x(t, r) : t[r];
								  };
						}),
						(v.matcher = v.matches =
							function (t) {
								return (
									(t = v.extendOwn({}, t)),
									function (r) {
										return v.isMatch(r, t);
									}
								);
							}),
						(v.times = function (t, r, i) {
							var e = Array(Math.max(0, t));
							r = w(r, i, 1);
							for (var n = 0; n < t; n++) e[n] = r(n);
							return e;
						}),
						(v.random = function (t, r) {
							return null == r && ((r = t), (t = 0)), t + Math.floor(Math.random() * (r - t + 1));
						}),
						(v.now =
							Date.now ||
							function () {
								return new Date().getTime();
							});
					var H = {
							'&': '&amp;',
							'<': '&lt;',
							'>': '&gt;',
							'"': '&quot;',
							"'": '&#x27;',
							'`': '&#x60;',
						},
						W = v.invert(H),
						G = function (t) {
							var r = function (r) {
									return t[r];
								},
								i = '(?:' + v.keys(t).join('|') + ')',
								e = RegExp(i),
								n = RegExp(i, 'g');
							return function (t) {
								return (t = null == t ? '' : '' + t), e.test(t) ? t.replace(n, r) : t;
							};
						};
					(v.escape = G(H)),
						(v.unescape = G(W)),
						(v.result = function (t, r, i) {
							v.isArray(r) || (r = [r]);
							var e = r.length;
							if (!e) return v.isFunction(i) ? i.call(t) : i;
							for (var n = 0; n < e; n++) {
								var o = null == t ? void 0 : t[r[n]];
								void 0 === o && ((o = i), (n = e)), (t = v.isFunction(o) ? o.call(t) : o);
							}
							return t;
						});
					var Y = 0;
					(v.uniqueId = function (t) {
						var r = ++Y + '';
						return t ? t + r : r;
					}),
						(v.templateSettings = {
							evaluate: /<%([\s\S]+?)%>/g,
							interpolate: /<%=([\s\S]+?)%>/g,
							escape: /<%-([\s\S]+?)%>/g,
						});
					var $ = /(.)^/,
						V = {
							"'": "'",
							'\\': '\\',
							'\r': 'r',
							'\n': 'n',
							'\u2028': 'u2028',
							'\u2029': 'u2029',
						},
						J = /\\|'|\r|\n|\u2028|\u2029/g,
						K = function (t) {
							return '\\' + V[t];
						};
					(v.template = function (t, r, i) {
						!r && i && (r = i), (r = v.defaults({}, r, v.templateSettings));
						var e,
							n = RegExp(
								[
									(r.escape || $).source,
									(r.interpolate || $).source,
									(r.evaluate || $).source,
								].join('|') + '|$',
								'g'
							),
							o = 0,
							s = "__p+='";
						t.replace(n, function (r, i, e, n, h) {
							return (
								(s += t.slice(o, h).replace(J, K)),
								(o = h + r.length),
								i
									? (s += "'+\n((__t=(" + i + "))==null?'':_.escape(__t))+\n'")
									: e
									? (s += "'+\n((__t=(" + e + "))==null?'':__t)+\n'")
									: n && (s += "';\n" + n + "\n__p+='"),
								r
							);
						}),
							(s += "';\n"),
							r.variable || (s = 'with(obj||{}){\n' + s + '}\n'),
							(s =
								"var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};\n" +
								s +
								'return __p;\n');
						try {
							e = new Function(r.variable || 'obj', '_', s);
						} catch (t) {
							throw ((t.source = s), t);
						}
						var h = function (t) {
								return e.call(this, t, v);
							},
							u = r.variable || 'obj';
						return (h.source = 'function(' + u + '){\n' + s + '}'), h;
					}),
						(v.chain = function (t) {
							var r = v(t);
							return (r._chain = !0), r;
						});
					var X = function (t, r) {
						return t._chain ? v(r).chain() : r;
					};
					(v.mixin = function (t) {
						return (
							v.each(v.functions(t), function (r) {
								var i = (v[r] = t[r]);
								v.prototype[r] = function () {
									var t = [this._wrapped];
									return a.apply(t, arguments), X(this, i.apply(v, t));
								};
							}),
							v
						);
					}),
						v.mixin(v),
						v.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function (t) {
							var r = s[t];
							v.prototype[t] = function () {
								var i = this._wrapped;
								return (
									r.apply(i, arguments),
									('shift' !== t && 'splice' !== t) || 0 !== i.length || delete i[0],
									X(this, i)
								);
							};
						}),
						v.each(['concat', 'join', 'slice'], function (t) {
							var r = s[t];
							v.prototype[t] = function () {
								return X(this, r.apply(this._wrapped, arguments));
							};
						}),
						(v.prototype.value = function () {
							return this._wrapped;
						}),
						(v.prototype.valueOf = v.prototype.toJSON = v.prototype.value),
						(v.prototype.toString = function () {
							return String(this._wrapped);
						}),
						void 0 ===
							(e = function () {
								return v;
							}.apply(r, [])) || (i.exports = e);
				})();
			}.call(this, i(3), i(0)(t)));
		},
		function (t, r, i) {
			var e = i(25),
				n = i(26);
			t.exports = function (t) {
				if ('string' == typeof t || 'number' == typeof t) {
					var r = new e(1),
						i = String(t).toLowerCase().trim(),
						o = '0x' === i.substr(0, 2) || '-0x' === i.substr(0, 3),
						s = n(i);
					if (
						('-' === s.substr(0, 1) && ((s = n(s.slice(1))), (r = new e(-1, 10))),
						(!(s = '' === s ? '0' : s).match(/^-?[0-9]+$/) && s.match(/^[0-9A-Fa-f]+$/)) ||
							s.match(/^[a-fA-F]+$/) ||
							(!0 === o && s.match(/^[0-9A-Fa-f]+$/)))
					)
						return new e(s, 16).mul(r);
					if ((s.match(/^-?[0-9]+$/) || '' === s) && !1 === o) return new e(s, 10).mul(r);
				} else if (
					'object' == typeof t &&
					t.toString &&
					!t.pop &&
					!t.push &&
					t.toString(10).match(/^-?[0-9]+$/) &&
					(t.mul || t.dividedToIntegerBy)
				)
					return new e(t.toString(10), 10);
				throw new Error(
					'[number-to-bn] while converting number ' +
						JSON.stringify(t) +
						' to BN.js instance, error: invalid number value. Value must be an integer, hex string, BN or BigNumber instance. Note, decimals are not supported.'
				);
			};
		},
		function (t, r, i) {
			(function (t) {
				!(function (t, r) {
					'use strict';
					function e(t, r) {
						if (!t) throw new Error(r || 'Assertion failed');
					}
					function n(t, r) {
						t.super_ = r;
						var i = function () {};
						(i.prototype = r.prototype), (t.prototype = new i()), (t.prototype.constructor = t);
					}
					function o(t, r, i) {
						if (o.isBN(t)) return t;
						(this.negative = 0),
							(this.words = null),
							(this.length = 0),
							(this.red = null),
							null !== t &&
								(('le' !== r && 'be' !== r) || ((i = r), (r = 10)),
								this._init(t || 0, r || 10, i || 'be'));
					}
					var s;
					'object' == typeof t ? (t.exports = o) : (r.BN = o), (o.BN = o), (o.wordSize = 26);
					try {
						s =
							'undefined' != typeof window && void 0 !== window.Buffer
								? window.Buffer
								: i(37).Buffer;
					} catch (t) {}
					function h(t, r) {
						var i = t.charCodeAt(r);
						return i >= 65 && i <= 70 ? i - 55 : i >= 97 && i <= 102 ? i - 87 : (i - 48) & 15;
					}
					function u(t, r, i) {
						var e = h(t, i);
						return i - 1 >= r && (e |= h(t, i - 1) << 4), e;
					}
					function a(t, r, i, e) {
						for (var n = 0, o = Math.min(t.length, i), s = r; s < o; s++) {
							var h = t.charCodeAt(s) - 48;
							(n *= e), (n += h >= 49 ? h - 49 + 10 : h >= 17 ? h - 17 + 10 : h);
						}
						return n;
					}
					(o.isBN = function (t) {
						return (
							t instanceof o ||
							(null !== t &&
								'object' == typeof t &&
								t.constructor.wordSize === o.wordSize &&
								Array.isArray(t.words))
						);
					}),
						(o.max = function (t, r) {
							return t.cmp(r) > 0 ? t : r;
						}),
						(o.min = function (t, r) {
							return t.cmp(r) < 0 ? t : r;
						}),
						(o.prototype._init = function (t, r, i) {
							if ('number' == typeof t) return this._initNumber(t, r, i);
							if ('object' == typeof t) return this._initArray(t, r, i);
							'hex' === r && (r = 16), e(r === (0 | r) && r >= 2 && r <= 36);
							var n = 0;
							'-' === (t = t.toString().replace(/\s+/g, ''))[0] && (n++, (this.negative = 1)),
								n < t.length &&
									(16 === r
										? this._parseHex(t, n, i)
										: (this._parseBase(t, r, n),
										  'le' === i && this._initArray(this.toArray(), r, i)));
						}),
						(o.prototype._initNumber = function (t, r, i) {
							t < 0 && ((this.negative = 1), (t = -t)),
								t < 67108864
									? ((this.words = [67108863 & t]), (this.length = 1))
									: t < 4503599627370496
									? ((this.words = [67108863 & t, (t / 67108864) & 67108863]), (this.length = 2))
									: (e(t < 9007199254740992),
									  (this.words = [67108863 & t, (t / 67108864) & 67108863, 1]),
									  (this.length = 3)),
								'le' === i && this._initArray(this.toArray(), r, i);
						}),
						(o.prototype._initArray = function (t, r, i) {
							if ((e('number' == typeof t.length), t.length <= 0))
								return (this.words = [0]), (this.length = 1), this;
							(this.length = Math.ceil(t.length / 3)), (this.words = new Array(this.length));
							for (var n = 0; n < this.length; n++) this.words[n] = 0;
							var o,
								s,
								h = 0;
							if ('be' === i)
								for (n = t.length - 1, o = 0; n >= 0; n -= 3)
									(s = t[n] | (t[n - 1] << 8) | (t[n - 2] << 16)),
										(this.words[o] |= (s << h) & 67108863),
										(this.words[o + 1] = (s >>> (26 - h)) & 67108863),
										(h += 24) >= 26 && ((h -= 26), o++);
							else if ('le' === i)
								for (n = 0, o = 0; n < t.length; n += 3)
									(s = t[n] | (t[n + 1] << 8) | (t[n + 2] << 16)),
										(this.words[o] |= (s << h) & 67108863),
										(this.words[o + 1] = (s >>> (26 - h)) & 67108863),
										(h += 24) >= 26 && ((h -= 26), o++);
							return this.strip();
						}),
						(o.prototype._parseHex = function (t, r, i) {
							(this.length = Math.ceil((t.length - r) / 6)), (this.words = new Array(this.length));
							for (var e = 0; e < this.length; e++) this.words[e] = 0;
							var n,
								o = 0,
								s = 0;
							if ('be' === i)
								for (e = t.length - 1; e >= r; e -= 2)
									(n = u(t, r, e) << o),
										(this.words[s] |= 67108863 & n),
										o >= 18 ? ((o -= 18), (s += 1), (this.words[s] |= n >>> 26)) : (o += 8);
							else
								for (e = (t.length - r) % 2 == 0 ? r + 1 : r; e < t.length; e += 2)
									(n = u(t, r, e) << o),
										(this.words[s] |= 67108863 & n),
										o >= 18 ? ((o -= 18), (s += 1), (this.words[s] |= n >>> 26)) : (o += 8);
							this.strip();
						}),
						(o.prototype._parseBase = function (t, r, i) {
							(this.words = [0]), (this.length = 1);
							for (var e = 0, n = 1; n <= 67108863; n *= r) e++;
							e--, (n = (n / r) | 0);
							for (
								var o = t.length - i, s = o % e, h = Math.min(o, o - s) + i, u = 0, l = i;
								l < h;
								l += e
							)
								(u = a(t, l, l + e, r)),
									this.imuln(n),
									this.words[0] + u < 67108864 ? (this.words[0] += u) : this._iaddn(u);
							if (0 !== s) {
								var f = 1;
								for (u = a(t, l, t.length, r), l = 0; l < s; l++) f *= r;
								this.imuln(f), this.words[0] + u < 67108864 ? (this.words[0] += u) : this._iaddn(u);
							}
							this.strip();
						}),
						(o.prototype.copy = function (t) {
							t.words = new Array(this.length);
							for (var r = 0; r < this.length; r++) t.words[r] = this.words[r];
							(t.length = this.length), (t.negative = this.negative), (t.red = this.red);
						}),
						(o.prototype.clone = function () {
							var t = new o(null);
							return this.copy(t), t;
						}),
						(o.prototype._expand = function (t) {
							for (; this.length < t; ) this.words[this.length++] = 0;
							return this;
						}),
						(o.prototype.strip = function () {
							for (; this.length > 1 && 0 === this.words[this.length - 1]; ) this.length--;
							return this._normSign();
						}),
						(o.prototype._normSign = function () {
							return 1 === this.length && 0 === this.words[0] && (this.negative = 0), this;
						}),
						(o.prototype.inspect = function () {
							return (this.red ? '<BN-R: ' : '<BN: ') + this.toString(16) + '>';
						});
					var l = [
							'',
							'0',
							'00',
							'000',
							'0000',
							'00000',
							'000000',
							'0000000',
							'00000000',
							'000000000',
							'0000000000',
							'00000000000',
							'000000000000',
							'0000000000000',
							'00000000000000',
							'000000000000000',
							'0000000000000000',
							'00000000000000000',
							'000000000000000000',
							'0000000000000000000',
							'00000000000000000000',
							'000000000000000000000',
							'0000000000000000000000',
							'00000000000000000000000',
							'000000000000000000000000',
							'0000000000000000000000000',
						],
						f = [
							0, 0, 25, 16, 12, 11, 10, 9, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5,
							5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
						],
						m = [
							0, 0, 33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216, 43046721,
							1e7, 19487171, 35831808, 62748517, 7529536, 11390625, 16777216, 24137569, 34012224,
							47045881, 64e6, 4084101, 5153632, 6436343, 7962624, 9765625, 11881376, 14348907,
							17210368, 20511149, 243e5, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176,
						];
					function c(t, r, i) {
						i.negative = r.negative ^ t.negative;
						var e = (t.length + r.length) | 0;
						(i.length = e), (e = (e - 1) | 0);
						var n = 0 | t.words[0],
							o = 0 | r.words[0],
							s = n * o,
							h = 67108863 & s,
							u = (s / 67108864) | 0;
						i.words[0] = h;
						for (var a = 1; a < e; a++) {
							for (
								var l = u >>> 26,
									f = 67108863 & u,
									m = Math.min(a, r.length - 1),
									c = Math.max(0, a - t.length + 1);
								c <= m;
								c++
							) {
								var d = (a - c) | 0;
								(l += ((s = (n = 0 | t.words[d]) * (o = 0 | r.words[c]) + f) / 67108864) | 0),
									(f = 67108863 & s);
							}
							(i.words[a] = 0 | f), (u = 0 | l);
						}
						return 0 !== u ? (i.words[a] = 0 | u) : i.length--, i.strip();
					}
					(o.prototype.toString = function (t, r) {
						var i;
						if (((r = 0 | r || 1), 16 === (t = t || 10) || 'hex' === t)) {
							i = '';
							for (var n = 0, o = 0, s = 0; s < this.length; s++) {
								var h = this.words[s],
									u = (16777215 & ((h << n) | o)).toString(16);
								(i =
									0 !== (o = (h >>> (24 - n)) & 16777215) || s !== this.length - 1
										? l[6 - u.length] + u + i
										: u + i),
									(n += 2) >= 26 && ((n -= 26), s--);
							}
							for (0 !== o && (i = o.toString(16) + i); i.length % r != 0; ) i = '0' + i;
							return 0 !== this.negative && (i = '-' + i), i;
						}
						if (t === (0 | t) && t >= 2 && t <= 36) {
							var a = f[t],
								c = m[t];
							i = '';
							var d = this.clone();
							for (d.negative = 0; !d.isZero(); ) {
								var p = d.modn(c).toString(t);
								i = (d = d.idivn(c)).isZero() ? p + i : l[a - p.length] + p + i;
							}
							for (this.isZero() && (i = '0' + i); i.length % r != 0; ) i = '0' + i;
							return 0 !== this.negative && (i = '-' + i), i;
						}
						e(!1, 'Base should be between 2 and 36');
					}),
						(o.prototype.toNumber = function () {
							var t = this.words[0];
							return (
								2 === this.length
									? (t += 67108864 * this.words[1])
									: 3 === this.length && 1 === this.words[2]
									? (t += 4503599627370496 + 67108864 * this.words[1])
									: this.length > 2 && e(!1, 'Number can only safely store up to 53 bits'),
								0 !== this.negative ? -t : t
							);
						}),
						(o.prototype.toJSON = function () {
							return this.toString(16);
						}),
						(o.prototype.toBuffer = function (t, r) {
							return e(void 0 !== s), this.toArrayLike(s, t, r);
						}),
						(o.prototype.toArray = function (t, r) {
							return this.toArrayLike(Array, t, r);
						}),
						(o.prototype.toArrayLike = function (t, r, i) {
							var n = this.byteLength(),
								o = i || Math.max(1, n);
							e(n <= o, 'byte array longer than desired length'),
								e(o > 0, 'Requested array length <= 0'),
								this.strip();
							var s,
								h,
								u = 'le' === r,
								a = new t(o),
								l = this.clone();
							if (u) {
								for (h = 0; !l.isZero(); h++) (s = l.andln(255)), l.iushrn(8), (a[h] = s);
								for (; h < o; h++) a[h] = 0;
							} else {
								for (h = 0; h < o - n; h++) a[h] = 0;
								for (h = 0; !l.isZero(); h++) (s = l.andln(255)), l.iushrn(8), (a[o - h - 1] = s);
							}
							return a;
						}),
						Math.clz32
							? (o.prototype._countBits = function (t) {
									return 32 - Math.clz32(t);
							  })
							: (o.prototype._countBits = function (t) {
									var r = t,
										i = 0;
									return (
										r >= 4096 && ((i += 13), (r >>>= 13)),
										r >= 64 && ((i += 7), (r >>>= 7)),
										r >= 8 && ((i += 4), (r >>>= 4)),
										r >= 2 && ((i += 2), (r >>>= 2)),
										i + r
									);
							  }),
						(o.prototype._zeroBits = function (t) {
							if (0 === t) return 26;
							var r = t,
								i = 0;
							return (
								0 == (8191 & r) && ((i += 13), (r >>>= 13)),
								0 == (127 & r) && ((i += 7), (r >>>= 7)),
								0 == (15 & r) && ((i += 4), (r >>>= 4)),
								0 == (3 & r) && ((i += 2), (r >>>= 2)),
								0 == (1 & r) && i++,
								i
							);
						}),
						(o.prototype.bitLength = function () {
							var t = this.words[this.length - 1],
								r = this._countBits(t);
							return 26 * (this.length - 1) + r;
						}),
						(o.prototype.zeroBits = function () {
							if (this.isZero()) return 0;
							for (var t = 0, r = 0; r < this.length; r++) {
								var i = this._zeroBits(this.words[r]);
								if (((t += i), 26 !== i)) break;
							}
							return t;
						}),
						(o.prototype.byteLength = function () {
							return Math.ceil(this.bitLength() / 8);
						}),
						(o.prototype.toTwos = function (t) {
							return 0 !== this.negative ? this.abs().inotn(t).iaddn(1) : this.clone();
						}),
						(o.prototype.fromTwos = function (t) {
							return this.testn(t - 1) ? this.notn(t).iaddn(1).ineg() : this.clone();
						}),
						(o.prototype.isNeg = function () {
							return 0 !== this.negative;
						}),
						(o.prototype.neg = function () {
							return this.clone().ineg();
						}),
						(o.prototype.ineg = function () {
							return this.isZero() || (this.negative ^= 1), this;
						}),
						(o.prototype.iuor = function (t) {
							for (; this.length < t.length; ) this.words[this.length++] = 0;
							for (var r = 0; r < t.length; r++) this.words[r] = this.words[r] | t.words[r];
							return this.strip();
						}),
						(o.prototype.ior = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuor(t);
						}),
						(o.prototype.or = function (t) {
							return this.length > t.length ? this.clone().ior(t) : t.clone().ior(this);
						}),
						(o.prototype.uor = function (t) {
							return this.length > t.length ? this.clone().iuor(t) : t.clone().iuor(this);
						}),
						(o.prototype.iuand = function (t) {
							var r;
							r = this.length > t.length ? t : this;
							for (var i = 0; i < r.length; i++) this.words[i] = this.words[i] & t.words[i];
							return (this.length = r.length), this.strip();
						}),
						(o.prototype.iand = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuand(t);
						}),
						(o.prototype.and = function (t) {
							return this.length > t.length ? this.clone().iand(t) : t.clone().iand(this);
						}),
						(o.prototype.uand = function (t) {
							return this.length > t.length ? this.clone().iuand(t) : t.clone().iuand(this);
						}),
						(o.prototype.iuxor = function (t) {
							var r, i;
							this.length > t.length ? ((r = this), (i = t)) : ((r = t), (i = this));
							for (var e = 0; e < i.length; e++) this.words[e] = r.words[e] ^ i.words[e];
							if (this !== r) for (; e < r.length; e++) this.words[e] = r.words[e];
							return (this.length = r.length), this.strip();
						}),
						(o.prototype.ixor = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuxor(t);
						}),
						(o.prototype.xor = function (t) {
							return this.length > t.length ? this.clone().ixor(t) : t.clone().ixor(this);
						}),
						(o.prototype.uxor = function (t) {
							return this.length > t.length ? this.clone().iuxor(t) : t.clone().iuxor(this);
						}),
						(o.prototype.inotn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = 0 | Math.ceil(t / 26),
								i = t % 26;
							this._expand(r), i > 0 && r--;
							for (var n = 0; n < r; n++) this.words[n] = 67108863 & ~this.words[n];
							return (
								i > 0 && (this.words[n] = ~this.words[n] & (67108863 >> (26 - i))), this.strip()
							);
						}),
						(o.prototype.notn = function (t) {
							return this.clone().inotn(t);
						}),
						(o.prototype.setn = function (t, r) {
							e('number' == typeof t && t >= 0);
							var i = (t / 26) | 0,
								n = t % 26;
							return (
								this._expand(i + 1),
								(this.words[i] = r ? this.words[i] | (1 << n) : this.words[i] & ~(1 << n)),
								this.strip()
							);
						}),
						(o.prototype.iadd = function (t) {
							var r, i, e;
							if (0 !== this.negative && 0 === t.negative)
								return (
									(this.negative = 0), (r = this.isub(t)), (this.negative ^= 1), this._normSign()
								);
							if (0 === this.negative && 0 !== t.negative)
								return (t.negative = 0), (r = this.isub(t)), (t.negative = 1), r._normSign();
							this.length > t.length ? ((i = this), (e = t)) : ((i = t), (e = this));
							for (var n = 0, o = 0; o < e.length; o++)
								(r = (0 | i.words[o]) + (0 | e.words[o]) + n),
									(this.words[o] = 67108863 & r),
									(n = r >>> 26);
							for (; 0 !== n && o < i.length; o++)
								(r = (0 | i.words[o]) + n), (this.words[o] = 67108863 & r), (n = r >>> 26);
							if (((this.length = i.length), 0 !== n)) (this.words[this.length] = n), this.length++;
							else if (i !== this) for (; o < i.length; o++) this.words[o] = i.words[o];
							return this;
						}),
						(o.prototype.add = function (t) {
							var r;
							return 0 !== t.negative && 0 === this.negative
								? ((t.negative = 0), (r = this.sub(t)), (t.negative ^= 1), r)
								: 0 === t.negative && 0 !== this.negative
								? ((this.negative = 0), (r = t.sub(this)), (this.negative = 1), r)
								: this.length > t.length
								? this.clone().iadd(t)
								: t.clone().iadd(this);
						}),
						(o.prototype.isub = function (t) {
							if (0 !== t.negative) {
								t.negative = 0;
								var r = this.iadd(t);
								return (t.negative = 1), r._normSign();
							}
							if (0 !== this.negative)
								return (this.negative = 0), this.iadd(t), (this.negative = 1), this._normSign();
							var i,
								e,
								n = this.cmp(t);
							if (0 === n) return (this.negative = 0), (this.length = 1), (this.words[0] = 0), this;
							n > 0 ? ((i = this), (e = t)) : ((i = t), (e = this));
							for (var o = 0, s = 0; s < e.length; s++)
								(o = (r = (0 | i.words[s]) - (0 | e.words[s]) + o) >> 26),
									(this.words[s] = 67108863 & r);
							for (; 0 !== o && s < i.length; s++)
								(o = (r = (0 | i.words[s]) + o) >> 26), (this.words[s] = 67108863 & r);
							if (0 === o && s < i.length && i !== this)
								for (; s < i.length; s++) this.words[s] = i.words[s];
							return (
								(this.length = Math.max(this.length, s)),
								i !== this && (this.negative = 1),
								this.strip()
							);
						}),
						(o.prototype.sub = function (t) {
							return this.clone().isub(t);
						});
					var d = function (t, r, i) {
						var e,
							n,
							o,
							s = t.words,
							h = r.words,
							u = i.words,
							a = 0,
							l = 0 | s[0],
							f = 8191 & l,
							m = l >>> 13,
							c = 0 | s[1],
							d = 8191 & c,
							p = c >>> 13,
							g = 0 | s[2],
							v = 8191 & g,
							y = g >>> 13,
							w = 0 | s[3],
							M = 8191 & w,
							b = w >>> 13,
							_ = 0 | s[4],
							A = 8191 & _,
							E = _ >>> 13,
							x = 0 | s[5],
							S = 8191 & x,
							N = x >>> 13,
							T = 0 | s[6],
							R = 8191 & T,
							k = T >>> 13,
							I = 0 | s[7],
							B = 8191 & I,
							O = I >>> 13,
							C = 0 | s[8],
							L = 8191 & C,
							j = C >>> 13,
							P = 0 | s[9],
							U = 8191 & P,
							F = P >>> 13,
							D = 0 | h[0],
							Z = 8191 & D,
							z = D >>> 13,
							q = 0 | h[1],
							H = 8191 & q,
							W = q >>> 13,
							G = 0 | h[2],
							Y = 8191 & G,
							$ = G >>> 13,
							V = 0 | h[3],
							J = 8191 & V,
							K = V >>> 13,
							X = 0 | h[4],
							Q = 8191 & X,
							tt = X >>> 13,
							rt = 0 | h[5],
							it = 8191 & rt,
							et = rt >>> 13,
							nt = 0 | h[6],
							ot = 8191 & nt,
							st = nt >>> 13,
							ht = 0 | h[7],
							ut = 8191 & ht,
							at = ht >>> 13,
							lt = 0 | h[8],
							ft = 8191 & lt,
							mt = lt >>> 13,
							ct = 0 | h[9],
							dt = 8191 & ct,
							pt = ct >>> 13;
						(i.negative = t.negative ^ r.negative), (i.length = 19);
						var gt =
							(((a + (e = Math.imul(f, Z))) | 0) +
								((8191 & (n = ((n = Math.imul(f, z)) + Math.imul(m, Z)) | 0)) << 13)) |
							0;
						(a = ((((o = Math.imul(m, z)) + (n >>> 13)) | 0) + (gt >>> 26)) | 0),
							(gt &= 67108863),
							(e = Math.imul(d, Z)),
							(n = ((n = Math.imul(d, z)) + Math.imul(p, Z)) | 0),
							(o = Math.imul(p, z));
						var vt =
							(((a + (e = (e + Math.imul(f, H)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, W)) | 0) + Math.imul(m, H)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, W)) | 0) + (n >>> 13)) | 0) + (vt >>> 26)) | 0),
							(vt &= 67108863),
							(e = Math.imul(v, Z)),
							(n = ((n = Math.imul(v, z)) + Math.imul(y, Z)) | 0),
							(o = Math.imul(y, z)),
							(e = (e + Math.imul(d, H)) | 0),
							(n = ((n = (n + Math.imul(d, W)) | 0) + Math.imul(p, H)) | 0),
							(o = (o + Math.imul(p, W)) | 0);
						var yt =
							(((a + (e = (e + Math.imul(f, Y)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, $)) | 0) + Math.imul(m, Y)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, $)) | 0) + (n >>> 13)) | 0) + (yt >>> 26)) | 0),
							(yt &= 67108863),
							(e = Math.imul(M, Z)),
							(n = ((n = Math.imul(M, z)) + Math.imul(b, Z)) | 0),
							(o = Math.imul(b, z)),
							(e = (e + Math.imul(v, H)) | 0),
							(n = ((n = (n + Math.imul(v, W)) | 0) + Math.imul(y, H)) | 0),
							(o = (o + Math.imul(y, W)) | 0),
							(e = (e + Math.imul(d, Y)) | 0),
							(n = ((n = (n + Math.imul(d, $)) | 0) + Math.imul(p, Y)) | 0),
							(o = (o + Math.imul(p, $)) | 0);
						var wt =
							(((a + (e = (e + Math.imul(f, J)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, K)) | 0) + Math.imul(m, J)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, K)) | 0) + (n >>> 13)) | 0) + (wt >>> 26)) | 0),
							(wt &= 67108863),
							(e = Math.imul(A, Z)),
							(n = ((n = Math.imul(A, z)) + Math.imul(E, Z)) | 0),
							(o = Math.imul(E, z)),
							(e = (e + Math.imul(M, H)) | 0),
							(n = ((n = (n + Math.imul(M, W)) | 0) + Math.imul(b, H)) | 0),
							(o = (o + Math.imul(b, W)) | 0),
							(e = (e + Math.imul(v, Y)) | 0),
							(n = ((n = (n + Math.imul(v, $)) | 0) + Math.imul(y, Y)) | 0),
							(o = (o + Math.imul(y, $)) | 0),
							(e = (e + Math.imul(d, J)) | 0),
							(n = ((n = (n + Math.imul(d, K)) | 0) + Math.imul(p, J)) | 0),
							(o = (o + Math.imul(p, K)) | 0);
						var Mt =
							(((a + (e = (e + Math.imul(f, Q)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, tt)) | 0) + Math.imul(m, Q)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, tt)) | 0) + (n >>> 13)) | 0) + (Mt >>> 26)) | 0),
							(Mt &= 67108863),
							(e = Math.imul(S, Z)),
							(n = ((n = Math.imul(S, z)) + Math.imul(N, Z)) | 0),
							(o = Math.imul(N, z)),
							(e = (e + Math.imul(A, H)) | 0),
							(n = ((n = (n + Math.imul(A, W)) | 0) + Math.imul(E, H)) | 0),
							(o = (o + Math.imul(E, W)) | 0),
							(e = (e + Math.imul(M, Y)) | 0),
							(n = ((n = (n + Math.imul(M, $)) | 0) + Math.imul(b, Y)) | 0),
							(o = (o + Math.imul(b, $)) | 0),
							(e = (e + Math.imul(v, J)) | 0),
							(n = ((n = (n + Math.imul(v, K)) | 0) + Math.imul(y, J)) | 0),
							(o = (o + Math.imul(y, K)) | 0),
							(e = (e + Math.imul(d, Q)) | 0),
							(n = ((n = (n + Math.imul(d, tt)) | 0) + Math.imul(p, Q)) | 0),
							(o = (o + Math.imul(p, tt)) | 0);
						var bt =
							(((a + (e = (e + Math.imul(f, it)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, et)) | 0) + Math.imul(m, it)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, et)) | 0) + (n >>> 13)) | 0) + (bt >>> 26)) | 0),
							(bt &= 67108863),
							(e = Math.imul(R, Z)),
							(n = ((n = Math.imul(R, z)) + Math.imul(k, Z)) | 0),
							(o = Math.imul(k, z)),
							(e = (e + Math.imul(S, H)) | 0),
							(n = ((n = (n + Math.imul(S, W)) | 0) + Math.imul(N, H)) | 0),
							(o = (o + Math.imul(N, W)) | 0),
							(e = (e + Math.imul(A, Y)) | 0),
							(n = ((n = (n + Math.imul(A, $)) | 0) + Math.imul(E, Y)) | 0),
							(o = (o + Math.imul(E, $)) | 0),
							(e = (e + Math.imul(M, J)) | 0),
							(n = ((n = (n + Math.imul(M, K)) | 0) + Math.imul(b, J)) | 0),
							(o = (o + Math.imul(b, K)) | 0),
							(e = (e + Math.imul(v, Q)) | 0),
							(n = ((n = (n + Math.imul(v, tt)) | 0) + Math.imul(y, Q)) | 0),
							(o = (o + Math.imul(y, tt)) | 0),
							(e = (e + Math.imul(d, it)) | 0),
							(n = ((n = (n + Math.imul(d, et)) | 0) + Math.imul(p, it)) | 0),
							(o = (o + Math.imul(p, et)) | 0);
						var _t =
							(((a + (e = (e + Math.imul(f, ot)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, st)) | 0) + Math.imul(m, ot)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, st)) | 0) + (n >>> 13)) | 0) + (_t >>> 26)) | 0),
							(_t &= 67108863),
							(e = Math.imul(B, Z)),
							(n = ((n = Math.imul(B, z)) + Math.imul(O, Z)) | 0),
							(o = Math.imul(O, z)),
							(e = (e + Math.imul(R, H)) | 0),
							(n = ((n = (n + Math.imul(R, W)) | 0) + Math.imul(k, H)) | 0),
							(o = (o + Math.imul(k, W)) | 0),
							(e = (e + Math.imul(S, Y)) | 0),
							(n = ((n = (n + Math.imul(S, $)) | 0) + Math.imul(N, Y)) | 0),
							(o = (o + Math.imul(N, $)) | 0),
							(e = (e + Math.imul(A, J)) | 0),
							(n = ((n = (n + Math.imul(A, K)) | 0) + Math.imul(E, J)) | 0),
							(o = (o + Math.imul(E, K)) | 0),
							(e = (e + Math.imul(M, Q)) | 0),
							(n = ((n = (n + Math.imul(M, tt)) | 0) + Math.imul(b, Q)) | 0),
							(o = (o + Math.imul(b, tt)) | 0),
							(e = (e + Math.imul(v, it)) | 0),
							(n = ((n = (n + Math.imul(v, et)) | 0) + Math.imul(y, it)) | 0),
							(o = (o + Math.imul(y, et)) | 0),
							(e = (e + Math.imul(d, ot)) | 0),
							(n = ((n = (n + Math.imul(d, st)) | 0) + Math.imul(p, ot)) | 0),
							(o = (o + Math.imul(p, st)) | 0);
						var At =
							(((a + (e = (e + Math.imul(f, ut)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, at)) | 0) + Math.imul(m, ut)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, at)) | 0) + (n >>> 13)) | 0) + (At >>> 26)) | 0),
							(At &= 67108863),
							(e = Math.imul(L, Z)),
							(n = ((n = Math.imul(L, z)) + Math.imul(j, Z)) | 0),
							(o = Math.imul(j, z)),
							(e = (e + Math.imul(B, H)) | 0),
							(n = ((n = (n + Math.imul(B, W)) | 0) + Math.imul(O, H)) | 0),
							(o = (o + Math.imul(O, W)) | 0),
							(e = (e + Math.imul(R, Y)) | 0),
							(n = ((n = (n + Math.imul(R, $)) | 0) + Math.imul(k, Y)) | 0),
							(o = (o + Math.imul(k, $)) | 0),
							(e = (e + Math.imul(S, J)) | 0),
							(n = ((n = (n + Math.imul(S, K)) | 0) + Math.imul(N, J)) | 0),
							(o = (o + Math.imul(N, K)) | 0),
							(e = (e + Math.imul(A, Q)) | 0),
							(n = ((n = (n + Math.imul(A, tt)) | 0) + Math.imul(E, Q)) | 0),
							(o = (o + Math.imul(E, tt)) | 0),
							(e = (e + Math.imul(M, it)) | 0),
							(n = ((n = (n + Math.imul(M, et)) | 0) + Math.imul(b, it)) | 0),
							(o = (o + Math.imul(b, et)) | 0),
							(e = (e + Math.imul(v, ot)) | 0),
							(n = ((n = (n + Math.imul(v, st)) | 0) + Math.imul(y, ot)) | 0),
							(o = (o + Math.imul(y, st)) | 0),
							(e = (e + Math.imul(d, ut)) | 0),
							(n = ((n = (n + Math.imul(d, at)) | 0) + Math.imul(p, ut)) | 0),
							(o = (o + Math.imul(p, at)) | 0);
						var Et =
							(((a + (e = (e + Math.imul(f, ft)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, mt)) | 0) + Math.imul(m, ft)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, mt)) | 0) + (n >>> 13)) | 0) + (Et >>> 26)) | 0),
							(Et &= 67108863),
							(e = Math.imul(U, Z)),
							(n = ((n = Math.imul(U, z)) + Math.imul(F, Z)) | 0),
							(o = Math.imul(F, z)),
							(e = (e + Math.imul(L, H)) | 0),
							(n = ((n = (n + Math.imul(L, W)) | 0) + Math.imul(j, H)) | 0),
							(o = (o + Math.imul(j, W)) | 0),
							(e = (e + Math.imul(B, Y)) | 0),
							(n = ((n = (n + Math.imul(B, $)) | 0) + Math.imul(O, Y)) | 0),
							(o = (o + Math.imul(O, $)) | 0),
							(e = (e + Math.imul(R, J)) | 0),
							(n = ((n = (n + Math.imul(R, K)) | 0) + Math.imul(k, J)) | 0),
							(o = (o + Math.imul(k, K)) | 0),
							(e = (e + Math.imul(S, Q)) | 0),
							(n = ((n = (n + Math.imul(S, tt)) | 0) + Math.imul(N, Q)) | 0),
							(o = (o + Math.imul(N, tt)) | 0),
							(e = (e + Math.imul(A, it)) | 0),
							(n = ((n = (n + Math.imul(A, et)) | 0) + Math.imul(E, it)) | 0),
							(o = (o + Math.imul(E, et)) | 0),
							(e = (e + Math.imul(M, ot)) | 0),
							(n = ((n = (n + Math.imul(M, st)) | 0) + Math.imul(b, ot)) | 0),
							(o = (o + Math.imul(b, st)) | 0),
							(e = (e + Math.imul(v, ut)) | 0),
							(n = ((n = (n + Math.imul(v, at)) | 0) + Math.imul(y, ut)) | 0),
							(o = (o + Math.imul(y, at)) | 0),
							(e = (e + Math.imul(d, ft)) | 0),
							(n = ((n = (n + Math.imul(d, mt)) | 0) + Math.imul(p, ft)) | 0),
							(o = (o + Math.imul(p, mt)) | 0);
						var xt =
							(((a + (e = (e + Math.imul(f, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, pt)) | 0) + Math.imul(m, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, pt)) | 0) + (n >>> 13)) | 0) + (xt >>> 26)) | 0),
							(xt &= 67108863),
							(e = Math.imul(U, H)),
							(n = ((n = Math.imul(U, W)) + Math.imul(F, H)) | 0),
							(o = Math.imul(F, W)),
							(e = (e + Math.imul(L, Y)) | 0),
							(n = ((n = (n + Math.imul(L, $)) | 0) + Math.imul(j, Y)) | 0),
							(o = (o + Math.imul(j, $)) | 0),
							(e = (e + Math.imul(B, J)) | 0),
							(n = ((n = (n + Math.imul(B, K)) | 0) + Math.imul(O, J)) | 0),
							(o = (o + Math.imul(O, K)) | 0),
							(e = (e + Math.imul(R, Q)) | 0),
							(n = ((n = (n + Math.imul(R, tt)) | 0) + Math.imul(k, Q)) | 0),
							(o = (o + Math.imul(k, tt)) | 0),
							(e = (e + Math.imul(S, it)) | 0),
							(n = ((n = (n + Math.imul(S, et)) | 0) + Math.imul(N, it)) | 0),
							(o = (o + Math.imul(N, et)) | 0),
							(e = (e + Math.imul(A, ot)) | 0),
							(n = ((n = (n + Math.imul(A, st)) | 0) + Math.imul(E, ot)) | 0),
							(o = (o + Math.imul(E, st)) | 0),
							(e = (e + Math.imul(M, ut)) | 0),
							(n = ((n = (n + Math.imul(M, at)) | 0) + Math.imul(b, ut)) | 0),
							(o = (o + Math.imul(b, at)) | 0),
							(e = (e + Math.imul(v, ft)) | 0),
							(n = ((n = (n + Math.imul(v, mt)) | 0) + Math.imul(y, ft)) | 0),
							(o = (o + Math.imul(y, mt)) | 0);
						var St =
							(((a + (e = (e + Math.imul(d, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(d, pt)) | 0) + Math.imul(p, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(p, pt)) | 0) + (n >>> 13)) | 0) + (St >>> 26)) | 0),
							(St &= 67108863),
							(e = Math.imul(U, Y)),
							(n = ((n = Math.imul(U, $)) + Math.imul(F, Y)) | 0),
							(o = Math.imul(F, $)),
							(e = (e + Math.imul(L, J)) | 0),
							(n = ((n = (n + Math.imul(L, K)) | 0) + Math.imul(j, J)) | 0),
							(o = (o + Math.imul(j, K)) | 0),
							(e = (e + Math.imul(B, Q)) | 0),
							(n = ((n = (n + Math.imul(B, tt)) | 0) + Math.imul(O, Q)) | 0),
							(o = (o + Math.imul(O, tt)) | 0),
							(e = (e + Math.imul(R, it)) | 0),
							(n = ((n = (n + Math.imul(R, et)) | 0) + Math.imul(k, it)) | 0),
							(o = (o + Math.imul(k, et)) | 0),
							(e = (e + Math.imul(S, ot)) | 0),
							(n = ((n = (n + Math.imul(S, st)) | 0) + Math.imul(N, ot)) | 0),
							(o = (o + Math.imul(N, st)) | 0),
							(e = (e + Math.imul(A, ut)) | 0),
							(n = ((n = (n + Math.imul(A, at)) | 0) + Math.imul(E, ut)) | 0),
							(o = (o + Math.imul(E, at)) | 0),
							(e = (e + Math.imul(M, ft)) | 0),
							(n = ((n = (n + Math.imul(M, mt)) | 0) + Math.imul(b, ft)) | 0),
							(o = (o + Math.imul(b, mt)) | 0);
						var Nt =
							(((a + (e = (e + Math.imul(v, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(v, pt)) | 0) + Math.imul(y, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(y, pt)) | 0) + (n >>> 13)) | 0) + (Nt >>> 26)) | 0),
							(Nt &= 67108863),
							(e = Math.imul(U, J)),
							(n = ((n = Math.imul(U, K)) + Math.imul(F, J)) | 0),
							(o = Math.imul(F, K)),
							(e = (e + Math.imul(L, Q)) | 0),
							(n = ((n = (n + Math.imul(L, tt)) | 0) + Math.imul(j, Q)) | 0),
							(o = (o + Math.imul(j, tt)) | 0),
							(e = (e + Math.imul(B, it)) | 0),
							(n = ((n = (n + Math.imul(B, et)) | 0) + Math.imul(O, it)) | 0),
							(o = (o + Math.imul(O, et)) | 0),
							(e = (e + Math.imul(R, ot)) | 0),
							(n = ((n = (n + Math.imul(R, st)) | 0) + Math.imul(k, ot)) | 0),
							(o = (o + Math.imul(k, st)) | 0),
							(e = (e + Math.imul(S, ut)) | 0),
							(n = ((n = (n + Math.imul(S, at)) | 0) + Math.imul(N, ut)) | 0),
							(o = (o + Math.imul(N, at)) | 0),
							(e = (e + Math.imul(A, ft)) | 0),
							(n = ((n = (n + Math.imul(A, mt)) | 0) + Math.imul(E, ft)) | 0),
							(o = (o + Math.imul(E, mt)) | 0);
						var Tt =
							(((a + (e = (e + Math.imul(M, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(M, pt)) | 0) + Math.imul(b, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(b, pt)) | 0) + (n >>> 13)) | 0) + (Tt >>> 26)) | 0),
							(Tt &= 67108863),
							(e = Math.imul(U, Q)),
							(n = ((n = Math.imul(U, tt)) + Math.imul(F, Q)) | 0),
							(o = Math.imul(F, tt)),
							(e = (e + Math.imul(L, it)) | 0),
							(n = ((n = (n + Math.imul(L, et)) | 0) + Math.imul(j, it)) | 0),
							(o = (o + Math.imul(j, et)) | 0),
							(e = (e + Math.imul(B, ot)) | 0),
							(n = ((n = (n + Math.imul(B, st)) | 0) + Math.imul(O, ot)) | 0),
							(o = (o + Math.imul(O, st)) | 0),
							(e = (e + Math.imul(R, ut)) | 0),
							(n = ((n = (n + Math.imul(R, at)) | 0) + Math.imul(k, ut)) | 0),
							(o = (o + Math.imul(k, at)) | 0),
							(e = (e + Math.imul(S, ft)) | 0),
							(n = ((n = (n + Math.imul(S, mt)) | 0) + Math.imul(N, ft)) | 0),
							(o = (o + Math.imul(N, mt)) | 0);
						var Rt =
							(((a + (e = (e + Math.imul(A, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(A, pt)) | 0) + Math.imul(E, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(E, pt)) | 0) + (n >>> 13)) | 0) + (Rt >>> 26)) | 0),
							(Rt &= 67108863),
							(e = Math.imul(U, it)),
							(n = ((n = Math.imul(U, et)) + Math.imul(F, it)) | 0),
							(o = Math.imul(F, et)),
							(e = (e + Math.imul(L, ot)) | 0),
							(n = ((n = (n + Math.imul(L, st)) | 0) + Math.imul(j, ot)) | 0),
							(o = (o + Math.imul(j, st)) | 0),
							(e = (e + Math.imul(B, ut)) | 0),
							(n = ((n = (n + Math.imul(B, at)) | 0) + Math.imul(O, ut)) | 0),
							(o = (o + Math.imul(O, at)) | 0),
							(e = (e + Math.imul(R, ft)) | 0),
							(n = ((n = (n + Math.imul(R, mt)) | 0) + Math.imul(k, ft)) | 0),
							(o = (o + Math.imul(k, mt)) | 0);
						var kt =
							(((a + (e = (e + Math.imul(S, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(S, pt)) | 0) + Math.imul(N, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(N, pt)) | 0) + (n >>> 13)) | 0) + (kt >>> 26)) | 0),
							(kt &= 67108863),
							(e = Math.imul(U, ot)),
							(n = ((n = Math.imul(U, st)) + Math.imul(F, ot)) | 0),
							(o = Math.imul(F, st)),
							(e = (e + Math.imul(L, ut)) | 0),
							(n = ((n = (n + Math.imul(L, at)) | 0) + Math.imul(j, ut)) | 0),
							(o = (o + Math.imul(j, at)) | 0),
							(e = (e + Math.imul(B, ft)) | 0),
							(n = ((n = (n + Math.imul(B, mt)) | 0) + Math.imul(O, ft)) | 0),
							(o = (o + Math.imul(O, mt)) | 0);
						var It =
							(((a + (e = (e + Math.imul(R, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(R, pt)) | 0) + Math.imul(k, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(k, pt)) | 0) + (n >>> 13)) | 0) + (It >>> 26)) | 0),
							(It &= 67108863),
							(e = Math.imul(U, ut)),
							(n = ((n = Math.imul(U, at)) + Math.imul(F, ut)) | 0),
							(o = Math.imul(F, at)),
							(e = (e + Math.imul(L, ft)) | 0),
							(n = ((n = (n + Math.imul(L, mt)) | 0) + Math.imul(j, ft)) | 0),
							(o = (o + Math.imul(j, mt)) | 0);
						var Bt =
							(((a + (e = (e + Math.imul(B, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(B, pt)) | 0) + Math.imul(O, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(O, pt)) | 0) + (n >>> 13)) | 0) + (Bt >>> 26)) | 0),
							(Bt &= 67108863),
							(e = Math.imul(U, ft)),
							(n = ((n = Math.imul(U, mt)) + Math.imul(F, ft)) | 0),
							(o = Math.imul(F, mt));
						var Ot =
							(((a + (e = (e + Math.imul(L, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(L, pt)) | 0) + Math.imul(j, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(j, pt)) | 0) + (n >>> 13)) | 0) + (Ot >>> 26)) | 0),
							(Ot &= 67108863);
						var Ct =
							(((a + (e = Math.imul(U, dt))) | 0) +
								((8191 & (n = ((n = Math.imul(U, pt)) + Math.imul(F, dt)) | 0)) << 13)) |
							0;
						return (
							(a = ((((o = Math.imul(F, pt)) + (n >>> 13)) | 0) + (Ct >>> 26)) | 0),
							(Ct &= 67108863),
							(u[0] = gt),
							(u[1] = vt),
							(u[2] = yt),
							(u[3] = wt),
							(u[4] = Mt),
							(u[5] = bt),
							(u[6] = _t),
							(u[7] = At),
							(u[8] = Et),
							(u[9] = xt),
							(u[10] = St),
							(u[11] = Nt),
							(u[12] = Tt),
							(u[13] = Rt),
							(u[14] = kt),
							(u[15] = It),
							(u[16] = Bt),
							(u[17] = Ot),
							(u[18] = Ct),
							0 !== a && ((u[19] = a), i.length++),
							i
						);
					};
					function p(t, r, i) {
						return new g().mulp(t, r, i);
					}
					function g(t, r) {
						(this.x = t), (this.y = r);
					}
					Math.imul || (d = c),
						(o.prototype.mulTo = function (t, r) {
							var i = this.length + t.length;
							return 10 === this.length && 10 === t.length
								? d(this, t, r)
								: i < 63
								? c(this, t, r)
								: i < 1024
								? (function (t, r, i) {
										(i.negative = r.negative ^ t.negative), (i.length = t.length + r.length);
										for (var e = 0, n = 0, o = 0; o < i.length - 1; o++) {
											var s = n;
											n = 0;
											for (
												var h = 67108863 & e,
													u = Math.min(o, r.length - 1),
													a = Math.max(0, o - t.length + 1);
												a <= u;
												a++
											) {
												var l = o - a,
													f = (0 | t.words[l]) * (0 | r.words[a]),
													m = 67108863 & f;
												(h = 67108863 & (m = (m + h) | 0)),
													(n +=
														(s = ((s = (s + ((f / 67108864) | 0)) | 0) + (m >>> 26)) | 0) >>> 26),
													(s &= 67108863);
											}
											(i.words[o] = h), (e = s), (s = n);
										}
										return 0 !== e ? (i.words[o] = e) : i.length--, i.strip();
								  })(this, t, r)
								: p(this, t, r);
						}),
						(g.prototype.makeRBT = function (t) {
							for (var r = new Array(t), i = o.prototype._countBits(t) - 1, e = 0; e < t; e++)
								r[e] = this.revBin(e, i, t);
							return r;
						}),
						(g.prototype.revBin = function (t, r, i) {
							if (0 === t || t === i - 1) return t;
							for (var e = 0, n = 0; n < r; n++) (e |= (1 & t) << (r - n - 1)), (t >>= 1);
							return e;
						}),
						(g.prototype.permute = function (t, r, i, e, n, o) {
							for (var s = 0; s < o; s++) (e[s] = r[t[s]]), (n[s] = i[t[s]]);
						}),
						(g.prototype.transform = function (t, r, i, e, n, o) {
							this.permute(o, t, r, i, e, n);
							for (var s = 1; s < n; s <<= 1)
								for (
									var h = s << 1,
										u = Math.cos((2 * Math.PI) / h),
										a = Math.sin((2 * Math.PI) / h),
										l = 0;
									l < n;
									l += h
								)
									for (var f = u, m = a, c = 0; c < s; c++) {
										var d = i[l + c],
											p = e[l + c],
											g = i[l + c + s],
											v = e[l + c + s],
											y = f * g - m * v;
										(v = f * v + m * g),
											(g = y),
											(i[l + c] = d + g),
											(e[l + c] = p + v),
											(i[l + c + s] = d - g),
											(e[l + c + s] = p - v),
											c !== h && ((y = u * f - a * m), (m = u * m + a * f), (f = y));
									}
						}),
						(g.prototype.guessLen13b = function (t, r) {
							var i = 1 | Math.max(r, t),
								e = 1 & i,
								n = 0;
							for (i = (i / 2) | 0; i; i >>>= 1) n++;
							return 1 << (n + 1 + e);
						}),
						(g.prototype.conjugate = function (t, r, i) {
							if (!(i <= 1))
								for (var e = 0; e < i / 2; e++) {
									var n = t[e];
									(t[e] = t[i - e - 1]),
										(t[i - e - 1] = n),
										(n = r[e]),
										(r[e] = -r[i - e - 1]),
										(r[i - e - 1] = -n);
								}
						}),
						(g.prototype.normalize13b = function (t, r) {
							for (var i = 0, e = 0; e < r / 2; e++) {
								var n = 8192 * Math.round(t[2 * e + 1] / r) + Math.round(t[2 * e] / r) + i;
								(t[e] = 67108863 & n), (i = n < 67108864 ? 0 : (n / 67108864) | 0);
							}
							return t;
						}),
						(g.prototype.convert13b = function (t, r, i, n) {
							for (var o = 0, s = 0; s < r; s++)
								(o += 0 | t[s]),
									(i[2 * s] = 8191 & o),
									(o >>>= 13),
									(i[2 * s + 1] = 8191 & o),
									(o >>>= 13);
							for (s = 2 * r; s < n; ++s) i[s] = 0;
							e(0 === o), e(0 == (-8192 & o));
						}),
						(g.prototype.stub = function (t) {
							for (var r = new Array(t), i = 0; i < t; i++) r[i] = 0;
							return r;
						}),
						(g.prototype.mulp = function (t, r, i) {
							var e = 2 * this.guessLen13b(t.length, r.length),
								n = this.makeRBT(e),
								o = this.stub(e),
								s = new Array(e),
								h = new Array(e),
								u = new Array(e),
								a = new Array(e),
								l = new Array(e),
								f = new Array(e),
								m = i.words;
							(m.length = e),
								this.convert13b(t.words, t.length, s, e),
								this.convert13b(r.words, r.length, a, e),
								this.transform(s, o, h, u, e, n),
								this.transform(a, o, l, f, e, n);
							for (var c = 0; c < e; c++) {
								var d = h[c] * l[c] - u[c] * f[c];
								(u[c] = h[c] * f[c] + u[c] * l[c]), (h[c] = d);
							}
							return (
								this.conjugate(h, u, e),
								this.transform(h, u, m, o, e, n),
								this.conjugate(m, o, e),
								this.normalize13b(m, e),
								(i.negative = t.negative ^ r.negative),
								(i.length = t.length + r.length),
								i.strip()
							);
						}),
						(o.prototype.mul = function (t) {
							var r = new o(null);
							return (r.words = new Array(this.length + t.length)), this.mulTo(t, r);
						}),
						(o.prototype.mulf = function (t) {
							var r = new o(null);
							return (r.words = new Array(this.length + t.length)), p(this, t, r);
						}),
						(o.prototype.imul = function (t) {
							return this.clone().mulTo(t, this);
						}),
						(o.prototype.imuln = function (t) {
							e('number' == typeof t), e(t < 67108864);
							for (var r = 0, i = 0; i < this.length; i++) {
								var n = (0 | this.words[i]) * t,
									o = (67108863 & n) + (67108863 & r);
								(r >>= 26),
									(r += (n / 67108864) | 0),
									(r += o >>> 26),
									(this.words[i] = 67108863 & o);
							}
							return 0 !== r && ((this.words[i] = r), this.length++), this;
						}),
						(o.prototype.muln = function (t) {
							return this.clone().imuln(t);
						}),
						(o.prototype.sqr = function () {
							return this.mul(this);
						}),
						(o.prototype.isqr = function () {
							return this.imul(this.clone());
						}),
						(o.prototype.pow = function (t) {
							var r = (function (t) {
								for (var r = new Array(t.bitLength()), i = 0; i < r.length; i++) {
									var e = (i / 26) | 0,
										n = i % 26;
									r[i] = (t.words[e] & (1 << n)) >>> n;
								}
								return r;
							})(t);
							if (0 === r.length) return new o(1);
							for (var i = this, e = 0; e < r.length && 0 === r[e]; e++, i = i.sqr());
							if (++e < r.length)
								for (var n = i.sqr(); e < r.length; e++, n = n.sqr()) 0 !== r[e] && (i = i.mul(n));
							return i;
						}),
						(o.prototype.iushln = function (t) {
							e('number' == typeof t && t >= 0);
							var r,
								i = t % 26,
								n = (t - i) / 26,
								o = (67108863 >>> (26 - i)) << (26 - i);
							if (0 !== i) {
								var s = 0;
								for (r = 0; r < this.length; r++) {
									var h = this.words[r] & o,
										u = ((0 | this.words[r]) - h) << i;
									(this.words[r] = u | s), (s = h >>> (26 - i));
								}
								s && ((this.words[r] = s), this.length++);
							}
							if (0 !== n) {
								for (r = this.length - 1; r >= 0; r--) this.words[r + n] = this.words[r];
								for (r = 0; r < n; r++) this.words[r] = 0;
								this.length += n;
							}
							return this.strip();
						}),
						(o.prototype.ishln = function (t) {
							return e(0 === this.negative), this.iushln(t);
						}),
						(o.prototype.iushrn = function (t, r, i) {
							var n;
							e('number' == typeof t && t >= 0), (n = r ? (r - (r % 26)) / 26 : 0);
							var o = t % 26,
								s = Math.min((t - o) / 26, this.length),
								h = 67108863 ^ ((67108863 >>> o) << o),
								u = i;
							if (((n -= s), (n = Math.max(0, n)), u)) {
								for (var a = 0; a < s; a++) u.words[a] = this.words[a];
								u.length = s;
							}
							if (0 === s);
							else if (this.length > s)
								for (this.length -= s, a = 0; a < this.length; a++)
									this.words[a] = this.words[a + s];
							else (this.words[0] = 0), (this.length = 1);
							var l = 0;
							for (a = this.length - 1; a >= 0 && (0 !== l || a >= n); a--) {
								var f = 0 | this.words[a];
								(this.words[a] = (l << (26 - o)) | (f >>> o)), (l = f & h);
							}
							return (
								u && 0 !== l && (u.words[u.length++] = l),
								0 === this.length && ((this.words[0] = 0), (this.length = 1)),
								this.strip()
							);
						}),
						(o.prototype.ishrn = function (t, r, i) {
							return e(0 === this.negative), this.iushrn(t, r, i);
						}),
						(o.prototype.shln = function (t) {
							return this.clone().ishln(t);
						}),
						(o.prototype.ushln = function (t) {
							return this.clone().iushln(t);
						}),
						(o.prototype.shrn = function (t) {
							return this.clone().ishrn(t);
						}),
						(o.prototype.ushrn = function (t) {
							return this.clone().iushrn(t);
						}),
						(o.prototype.testn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = t % 26,
								i = (t - r) / 26,
								n = 1 << r;
							return !(this.length <= i) && !!(this.words[i] & n);
						}),
						(o.prototype.imaskn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = t % 26,
								i = (t - r) / 26;
							if (
								(e(0 === this.negative, 'imaskn works only with positive numbers'),
								this.length <= i)
							)
								return this;
							if ((0 !== r && i++, (this.length = Math.min(i, this.length)), 0 !== r)) {
								var n = 67108863 ^ ((67108863 >>> r) << r);
								this.words[this.length - 1] &= n;
							}
							return this.strip();
						}),
						(o.prototype.maskn = function (t) {
							return this.clone().imaskn(t);
						}),
						(o.prototype.iaddn = function (t) {
							return (
								e('number' == typeof t),
								e(t < 67108864),
								t < 0
									? this.isubn(-t)
									: 0 !== this.negative
									? 1 === this.length && (0 | this.words[0]) < t
										? ((this.words[0] = t - (0 | this.words[0])), (this.negative = 0), this)
										: ((this.negative = 0), this.isubn(t), (this.negative = 1), this)
									: this._iaddn(t)
							);
						}),
						(o.prototype._iaddn = function (t) {
							this.words[0] += t;
							for (var r = 0; r < this.length && this.words[r] >= 67108864; r++)
								(this.words[r] -= 67108864),
									r === this.length - 1 ? (this.words[r + 1] = 1) : this.words[r + 1]++;
							return (this.length = Math.max(this.length, r + 1)), this;
						}),
						(o.prototype.isubn = function (t) {
							if ((e('number' == typeof t), e(t < 67108864), t < 0)) return this.iaddn(-t);
							if (0 !== this.negative)
								return (this.negative = 0), this.iaddn(t), (this.negative = 1), this;
							if (((this.words[0] -= t), 1 === this.length && this.words[0] < 0))
								(this.words[0] = -this.words[0]), (this.negative = 1);
							else
								for (var r = 0; r < this.length && this.words[r] < 0; r++)
									(this.words[r] += 67108864), (this.words[r + 1] -= 1);
							return this.strip();
						}),
						(o.prototype.addn = function (t) {
							return this.clone().iaddn(t);
						}),
						(o.prototype.subn = function (t) {
							return this.clone().isubn(t);
						}),
						(o.prototype.iabs = function () {
							return (this.negative = 0), this;
						}),
						(o.prototype.abs = function () {
							return this.clone().iabs();
						}),
						(o.prototype._ishlnsubmul = function (t, r, i) {
							var n,
								o,
								s = t.length + i;
							this._expand(s);
							var h = 0;
							for (n = 0; n < t.length; n++) {
								o = (0 | this.words[n + i]) + h;
								var u = (0 | t.words[n]) * r;
								(h = ((o -= 67108863 & u) >> 26) - ((u / 67108864) | 0)),
									(this.words[n + i] = 67108863 & o);
							}
							for (; n < this.length - i; n++)
								(h = (o = (0 | this.words[n + i]) + h) >> 26), (this.words[n + i] = 67108863 & o);
							if (0 === h) return this.strip();
							for (e(-1 === h), h = 0, n = 0; n < this.length; n++)
								(h = (o = -(0 | this.words[n]) + h) >> 26), (this.words[n] = 67108863 & o);
							return (this.negative = 1), this.strip();
						}),
						(o.prototype._wordDiv = function (t, r) {
							var i = (this.length, t.length),
								e = this.clone(),
								n = t,
								s = 0 | n.words[n.length - 1];
							0 !== (i = 26 - this._countBits(s)) &&
								((n = n.ushln(i)), e.iushln(i), (s = 0 | n.words[n.length - 1]));
							var h,
								u = e.length - n.length;
							if ('mod' !== r) {
								((h = new o(null)).length = u + 1), (h.words = new Array(h.length));
								for (var a = 0; a < h.length; a++) h.words[a] = 0;
							}
							var l = e.clone()._ishlnsubmul(n, 1, u);
							0 === l.negative && ((e = l), h && (h.words[u] = 1));
							for (var f = u - 1; f >= 0; f--) {
								var m = 67108864 * (0 | e.words[n.length + f]) + (0 | e.words[n.length + f - 1]);
								for (
									m = Math.min((m / s) | 0, 67108863), e._ishlnsubmul(n, m, f);
									0 !== e.negative;

								)
									m--, (e.negative = 0), e._ishlnsubmul(n, 1, f), e.isZero() || (e.negative ^= 1);
								h && (h.words[f] = m);
							}
							return (
								h && h.strip(),
								e.strip(),
								'div' !== r && 0 !== i && e.iushrn(i),
								{ div: h || null, mod: e }
							);
						}),
						(o.prototype.divmod = function (t, r, i) {
							return (
								e(!t.isZero()),
								this.isZero()
									? { div: new o(0), mod: new o(0) }
									: 0 !== this.negative && 0 === t.negative
									? ((h = this.neg().divmod(t, r)),
									  'mod' !== r && (n = h.div.neg()),
									  'div' !== r && ((s = h.mod.neg()), i && 0 !== s.negative && s.iadd(t)),
									  { div: n, mod: s })
									: 0 === this.negative && 0 !== t.negative
									? ((h = this.divmod(t.neg(), r)),
									  'mod' !== r && (n = h.div.neg()),
									  { div: n, mod: h.mod })
									: 0 != (this.negative & t.negative)
									? ((h = this.neg().divmod(t.neg(), r)),
									  'div' !== r && ((s = h.mod.neg()), i && 0 !== s.negative && s.isub(t)),
									  { div: h.div, mod: s })
									: t.length > this.length || this.cmp(t) < 0
									? { div: new o(0), mod: this }
									: 1 === t.length
									? 'div' === r
										? { div: this.divn(t.words[0]), mod: null }
										: 'mod' === r
										? { div: null, mod: new o(this.modn(t.words[0])) }
										: { div: this.divn(t.words[0]), mod: new o(this.modn(t.words[0])) }
									: this._wordDiv(t, r)
							);
							var n, s, h;
						}),
						(o.prototype.div = function (t) {
							return this.divmod(t, 'div', !1).div;
						}),
						(o.prototype.mod = function (t) {
							return this.divmod(t, 'mod', !1).mod;
						}),
						(o.prototype.umod = function (t) {
							return this.divmod(t, 'mod', !0).mod;
						}),
						(o.prototype.divRound = function (t) {
							var r = this.divmod(t);
							if (r.mod.isZero()) return r.div;
							var i = 0 !== r.div.negative ? r.mod.isub(t) : r.mod,
								e = t.ushrn(1),
								n = t.andln(1),
								o = i.cmp(e);
							return o < 0 || (1 === n && 0 === o)
								? r.div
								: 0 !== r.div.negative
								? r.div.isubn(1)
								: r.div.iaddn(1);
						}),
						(o.prototype.modn = function (t) {
							e(t <= 67108863);
							for (var r = (1 << 26) % t, i = 0, n = this.length - 1; n >= 0; n--)
								i = (r * i + (0 | this.words[n])) % t;
							return i;
						}),
						(o.prototype.idivn = function (t) {
							e(t <= 67108863);
							for (var r = 0, i = this.length - 1; i >= 0; i--) {
								var n = (0 | this.words[i]) + 67108864 * r;
								(this.words[i] = (n / t) | 0), (r = n % t);
							}
							return this.strip();
						}),
						(o.prototype.divn = function (t) {
							return this.clone().idivn(t);
						}),
						(o.prototype.egcd = function (t) {
							e(0 === t.negative), e(!t.isZero());
							var r = this,
								i = t.clone();
							r = 0 !== r.negative ? r.umod(t) : r.clone();
							for (
								var n = new o(1), s = new o(0), h = new o(0), u = new o(1), a = 0;
								r.isEven() && i.isEven();

							)
								r.iushrn(1), i.iushrn(1), ++a;
							for (var l = i.clone(), f = r.clone(); !r.isZero(); ) {
								for (var m = 0, c = 1; 0 == (r.words[0] & c) && m < 26; ++m, c <<= 1);
								if (m > 0)
									for (r.iushrn(m); m-- > 0; )
										(n.isOdd() || s.isOdd()) && (n.iadd(l), s.isub(f)), n.iushrn(1), s.iushrn(1);
								for (var d = 0, p = 1; 0 == (i.words[0] & p) && d < 26; ++d, p <<= 1);
								if (d > 0)
									for (i.iushrn(d); d-- > 0; )
										(h.isOdd() || u.isOdd()) && (h.iadd(l), u.isub(f)), h.iushrn(1), u.iushrn(1);
								r.cmp(i) >= 0
									? (r.isub(i), n.isub(h), s.isub(u))
									: (i.isub(r), h.isub(n), u.isub(s));
							}
							return { a: h, b: u, gcd: i.iushln(a) };
						}),
						(o.prototype._invmp = function (t) {
							e(0 === t.negative), e(!t.isZero());
							var r = this,
								i = t.clone();
							r = 0 !== r.negative ? r.umod(t) : r.clone();
							for (
								var n, s = new o(1), h = new o(0), u = i.clone();
								r.cmpn(1) > 0 && i.cmpn(1) > 0;

							) {
								for (var a = 0, l = 1; 0 == (r.words[0] & l) && a < 26; ++a, l <<= 1);
								if (a > 0) for (r.iushrn(a); a-- > 0; ) s.isOdd() && s.iadd(u), s.iushrn(1);
								for (var f = 0, m = 1; 0 == (i.words[0] & m) && f < 26; ++f, m <<= 1);
								if (f > 0) for (i.iushrn(f); f-- > 0; ) h.isOdd() && h.iadd(u), h.iushrn(1);
								r.cmp(i) >= 0 ? (r.isub(i), s.isub(h)) : (i.isub(r), h.isub(s));
							}
							return (n = 0 === r.cmpn(1) ? s : h).cmpn(0) < 0 && n.iadd(t), n;
						}),
						(o.prototype.gcd = function (t) {
							if (this.isZero()) return t.abs();
							if (t.isZero()) return this.abs();
							var r = this.clone(),
								i = t.clone();
							(r.negative = 0), (i.negative = 0);
							for (var e = 0; r.isEven() && i.isEven(); e++) r.iushrn(1), i.iushrn(1);
							for (;;) {
								for (; r.isEven(); ) r.iushrn(1);
								for (; i.isEven(); ) i.iushrn(1);
								var n = r.cmp(i);
								if (n < 0) {
									var o = r;
									(r = i), (i = o);
								} else if (0 === n || 0 === i.cmpn(1)) break;
								r.isub(i);
							}
							return i.iushln(e);
						}),
						(o.prototype.invm = function (t) {
							return this.egcd(t).a.umod(t);
						}),
						(o.prototype.isEven = function () {
							return 0 == (1 & this.words[0]);
						}),
						(o.prototype.isOdd = function () {
							return 1 == (1 & this.words[0]);
						}),
						(o.prototype.andln = function (t) {
							return this.words[0] & t;
						}),
						(o.prototype.bincn = function (t) {
							e('number' == typeof t);
							var r = t % 26,
								i = (t - r) / 26,
								n = 1 << r;
							if (this.length <= i) return this._expand(i + 1), (this.words[i] |= n), this;
							for (var o = n, s = i; 0 !== o && s < this.length; s++) {
								var h = 0 | this.words[s];
								(o = (h += o) >>> 26), (h &= 67108863), (this.words[s] = h);
							}
							return 0 !== o && ((this.words[s] = o), this.length++), this;
						}),
						(o.prototype.isZero = function () {
							return 1 === this.length && 0 === this.words[0];
						}),
						(o.prototype.cmpn = function (t) {
							var r,
								i = t < 0;
							if (0 !== this.negative && !i) return -1;
							if (0 === this.negative && i) return 1;
							if ((this.strip(), this.length > 1)) r = 1;
							else {
								i && (t = -t), e(t <= 67108863, 'Number is too big');
								var n = 0 | this.words[0];
								r = n === t ? 0 : n < t ? -1 : 1;
							}
							return 0 !== this.negative ? 0 | -r : r;
						}),
						(o.prototype.cmp = function (t) {
							if (0 !== this.negative && 0 === t.negative) return -1;
							if (0 === this.negative && 0 !== t.negative) return 1;
							var r = this.ucmp(t);
							return 0 !== this.negative ? 0 | -r : r;
						}),
						(o.prototype.ucmp = function (t) {
							if (this.length > t.length) return 1;
							if (this.length < t.length) return -1;
							for (var r = 0, i = this.length - 1; i >= 0; i--) {
								var e = 0 | this.words[i],
									n = 0 | t.words[i];
								if (e !== n) {
									e < n ? (r = -1) : e > n && (r = 1);
									break;
								}
							}
							return r;
						}),
						(o.prototype.gtn = function (t) {
							return 1 === this.cmpn(t);
						}),
						(o.prototype.gt = function (t) {
							return 1 === this.cmp(t);
						}),
						(o.prototype.gten = function (t) {
							return this.cmpn(t) >= 0;
						}),
						(o.prototype.gte = function (t) {
							return this.cmp(t) >= 0;
						}),
						(o.prototype.ltn = function (t) {
							return -1 === this.cmpn(t);
						}),
						(o.prototype.lt = function (t) {
							return -1 === this.cmp(t);
						}),
						(o.prototype.lten = function (t) {
							return this.cmpn(t) <= 0;
						}),
						(o.prototype.lte = function (t) {
							return this.cmp(t) <= 0;
						}),
						(o.prototype.eqn = function (t) {
							return 0 === this.cmpn(t);
						}),
						(o.prototype.eq = function (t) {
							return 0 === this.cmp(t);
						}),
						(o.red = function (t) {
							return new A(t);
						}),
						(o.prototype.toRed = function (t) {
							return (
								e(!this.red, 'Already a number in reduction context'),
								e(0 === this.negative, 'red works only with positives'),
								t.convertTo(this)._forceRed(t)
							);
						}),
						(o.prototype.fromRed = function () {
							return (
								e(this.red, 'fromRed works only with numbers in reduction context'),
								this.red.convertFrom(this)
							);
						}),
						(o.prototype._forceRed = function (t) {
							return (this.red = t), this;
						}),
						(o.prototype.forceRed = function (t) {
							return e(!this.red, 'Already a number in reduction context'), this._forceRed(t);
						}),
						(o.prototype.redAdd = function (t) {
							return e(this.red, 'redAdd works only with red numbers'), this.red.add(this, t);
						}),
						(o.prototype.redIAdd = function (t) {
							return e(this.red, 'redIAdd works only with red numbers'), this.red.iadd(this, t);
						}),
						(o.prototype.redSub = function (t) {
							return e(this.red, 'redSub works only with red numbers'), this.red.sub(this, t);
						}),
						(o.prototype.redISub = function (t) {
							return e(this.red, 'redISub works only with red numbers'), this.red.isub(this, t);
						}),
						(o.prototype.redShl = function (t) {
							return e(this.red, 'redShl works only with red numbers'), this.red.shl(this, t);
						}),
						(o.prototype.redMul = function (t) {
							return (
								e(this.red, 'redMul works only with red numbers'),
								this.red._verify2(this, t),
								this.red.mul(this, t)
							);
						}),
						(o.prototype.redIMul = function (t) {
							return (
								e(this.red, 'redMul works only with red numbers'),
								this.red._verify2(this, t),
								this.red.imul(this, t)
							);
						}),
						(o.prototype.redSqr = function () {
							return (
								e(this.red, 'redSqr works only with red numbers'),
								this.red._verify1(this),
								this.red.sqr(this)
							);
						}),
						(o.prototype.redISqr = function () {
							return (
								e(this.red, 'redISqr works only with red numbers'),
								this.red._verify1(this),
								this.red.isqr(this)
							);
						}),
						(o.prototype.redSqrt = function () {
							return (
								e(this.red, 'redSqrt works only with red numbers'),
								this.red._verify1(this),
								this.red.sqrt(this)
							);
						}),
						(o.prototype.redInvm = function () {
							return (
								e(this.red, 'redInvm works only with red numbers'),
								this.red._verify1(this),
								this.red.invm(this)
							);
						}),
						(o.prototype.redNeg = function () {
							return (
								e(this.red, 'redNeg works only with red numbers'),
								this.red._verify1(this),
								this.red.neg(this)
							);
						}),
						(o.prototype.redPow = function (t) {
							return (
								e(this.red && !t.red, 'redPow(normalNum)'),
								this.red._verify1(this),
								this.red.pow(this, t)
							);
						});
					var v = { k256: null, p224: null, p192: null, p25519: null };
					function y(t, r) {
						(this.name = t),
							(this.p = new o(r, 16)),
							(this.n = this.p.bitLength()),
							(this.k = new o(1).iushln(this.n).isub(this.p)),
							(this.tmp = this._tmp());
					}
					function w() {
						y.call(
							this,
							'k256',
							'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f'
						);
					}
					function M() {
						y.call(this, 'p224', 'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001');
					}
					function b() {
						y.call(this, 'p192', 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff');
					}
					function _() {
						y.call(
							this,
							'25519',
							'7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed'
						);
					}
					function A(t) {
						if ('string' == typeof t) {
							var r = o._prime(t);
							(this.m = r.p), (this.prime = r);
						} else e(t.gtn(1), 'modulus must be greater than 1'), (this.m = t), (this.prime = null);
					}
					function E(t) {
						A.call(this, t),
							(this.shift = this.m.bitLength()),
							this.shift % 26 != 0 && (this.shift += 26 - (this.shift % 26)),
							(this.r = new o(1).iushln(this.shift)),
							(this.r2 = this.imod(this.r.sqr())),
							(this.rinv = this.r._invmp(this.m)),
							(this.minv = this.rinv.mul(this.r).isubn(1).div(this.m)),
							(this.minv = this.minv.umod(this.r)),
							(this.minv = this.r.sub(this.minv));
					}
					(y.prototype._tmp = function () {
						var t = new o(null);
						return (t.words = new Array(Math.ceil(this.n / 13))), t;
					}),
						(y.prototype.ireduce = function (t) {
							var r,
								i = t;
							do {
								this.split(i, this.tmp), (r = (i = (i = this.imulK(i)).iadd(this.tmp)).bitLength());
							} while (r > this.n);
							var e = r < this.n ? -1 : i.ucmp(this.p);
							return (
								0 === e
									? ((i.words[0] = 0), (i.length = 1))
									: e > 0
									? i.isub(this.p)
									: void 0 !== i.strip
									? i.strip()
									: i._strip(),
								i
							);
						}),
						(y.prototype.split = function (t, r) {
							t.iushrn(this.n, 0, r);
						}),
						(y.prototype.imulK = function (t) {
							return t.imul(this.k);
						}),
						n(w, y),
						(w.prototype.split = function (t, r) {
							for (var i = Math.min(t.length, 9), e = 0; e < i; e++) r.words[e] = t.words[e];
							if (((r.length = i), t.length <= 9)) return (t.words[0] = 0), void (t.length = 1);
							var n = t.words[9];
							for (r.words[r.length++] = 4194303 & n, e = 10; e < t.length; e++) {
								var o = 0 | t.words[e];
								(t.words[e - 10] = ((4194303 & o) << 4) | (n >>> 22)), (n = o);
							}
							(n >>>= 22),
								(t.words[e - 10] = n),
								0 === n && t.length > 10 ? (t.length -= 10) : (t.length -= 9);
						}),
						(w.prototype.imulK = function (t) {
							(t.words[t.length] = 0), (t.words[t.length + 1] = 0), (t.length += 2);
							for (var r = 0, i = 0; i < t.length; i++) {
								var e = 0 | t.words[i];
								(r += 977 * e), (t.words[i] = 67108863 & r), (r = 64 * e + ((r / 67108864) | 0));
							}
							return (
								0 === t.words[t.length - 1] &&
									(t.length--, 0 === t.words[t.length - 1] && t.length--),
								t
							);
						}),
						n(M, y),
						n(b, y),
						n(_, y),
						(_.prototype.imulK = function (t) {
							for (var r = 0, i = 0; i < t.length; i++) {
								var e = 19 * (0 | t.words[i]) + r,
									n = 67108863 & e;
								(e >>>= 26), (t.words[i] = n), (r = e);
							}
							return 0 !== r && (t.words[t.length++] = r), t;
						}),
						(o._prime = function (t) {
							if (v[t]) return v[t];
							var r;
							if ('k256' === t) r = new w();
							else if ('p224' === t) r = new M();
							else if ('p192' === t) r = new b();
							else {
								if ('p25519' !== t) throw new Error('Unknown prime ' + t);
								r = new _();
							}
							return (v[t] = r), r;
						}),
						(A.prototype._verify1 = function (t) {
							e(0 === t.negative, 'red works only with positives'),
								e(t.red, 'red works only with red numbers');
						}),
						(A.prototype._verify2 = function (t, r) {
							e(0 == (t.negative | r.negative), 'red works only with positives'),
								e(t.red && t.red === r.red, 'red works only with red numbers');
						}),
						(A.prototype.imod = function (t) {
							return this.prime
								? this.prime.ireduce(t)._forceRed(this)
								: t.umod(this.m)._forceRed(this);
						}),
						(A.prototype.neg = function (t) {
							return t.isZero() ? t.clone() : this.m.sub(t)._forceRed(this);
						}),
						(A.prototype.add = function (t, r) {
							this._verify2(t, r);
							var i = t.add(r);
							return i.cmp(this.m) >= 0 && i.isub(this.m), i._forceRed(this);
						}),
						(A.prototype.iadd = function (t, r) {
							this._verify2(t, r);
							var i = t.iadd(r);
							return i.cmp(this.m) >= 0 && i.isub(this.m), i;
						}),
						(A.prototype.sub = function (t, r) {
							this._verify2(t, r);
							var i = t.sub(r);
							return i.cmpn(0) < 0 && i.iadd(this.m), i._forceRed(this);
						}),
						(A.prototype.isub = function (t, r) {
							this._verify2(t, r);
							var i = t.isub(r);
							return i.cmpn(0) < 0 && i.iadd(this.m), i;
						}),
						(A.prototype.shl = function (t, r) {
							return this._verify1(t), this.imod(t.ushln(r));
						}),
						(A.prototype.imul = function (t, r) {
							return this._verify2(t, r), this.imod(t.imul(r));
						}),
						(A.prototype.mul = function (t, r) {
							return this._verify2(t, r), this.imod(t.mul(r));
						}),
						(A.prototype.isqr = function (t) {
							return this.imul(t, t.clone());
						}),
						(A.prototype.sqr = function (t) {
							return this.mul(t, t);
						}),
						(A.prototype.sqrt = function (t) {
							if (t.isZero()) return t.clone();
							var r = this.m.andln(3);
							if ((e(r % 2 == 1), 3 === r)) {
								var i = this.m.add(new o(1)).iushrn(2);
								return this.pow(t, i);
							}
							for (var n = this.m.subn(1), s = 0; !n.isZero() && 0 === n.andln(1); )
								s++, n.iushrn(1);
							e(!n.isZero());
							var h = new o(1).toRed(this),
								u = h.redNeg(),
								a = this.m.subn(1).iushrn(1),
								l = this.m.bitLength();
							for (l = new o(2 * l * l).toRed(this); 0 !== this.pow(l, a).cmp(u); ) l.redIAdd(u);
							for (
								var f = this.pow(l, n),
									m = this.pow(t, n.addn(1).iushrn(1)),
									c = this.pow(t, n),
									d = s;
								0 !== c.cmp(h);

							) {
								for (var p = c, g = 0; 0 !== p.cmp(h); g++) p = p.redSqr();
								e(g < d);
								var v = this.pow(f, new o(1).iushln(d - g - 1));
								(m = m.redMul(v)), (f = v.redSqr()), (c = c.redMul(f)), (d = g);
							}
							return m;
						}),
						(A.prototype.invm = function (t) {
							var r = t._invmp(this.m);
							return 0 !== r.negative ? ((r.negative = 0), this.imod(r).redNeg()) : this.imod(r);
						}),
						(A.prototype.pow = function (t, r) {
							if (r.isZero()) return new o(1).toRed(this);
							if (0 === r.cmpn(1)) return t.clone();
							var i = new Array(16);
							(i[0] = new o(1).toRed(this)), (i[1] = t);
							for (var e = 2; e < i.length; e++) i[e] = this.mul(i[e - 1], t);
							var n = i[0],
								s = 0,
								h = 0,
								u = r.bitLength() % 26;
							for (0 === u && (u = 26), e = r.length - 1; e >= 0; e--) {
								for (var a = r.words[e], l = u - 1; l >= 0; l--) {
									var f = (a >> l) & 1;
									n !== i[0] && (n = this.sqr(n)),
										0 !== f || 0 !== s
											? ((s <<= 1),
											  (s |= f),
											  (4 === ++h || (0 === e && 0 === l)) &&
													((n = this.mul(n, i[s])), (h = 0), (s = 0)))
											: (h = 0);
								}
								u = 26;
							}
							return n;
						}),
						(A.prototype.convertTo = function (t) {
							var r = t.umod(this.m);
							return r === t ? r.clone() : r;
						}),
						(A.prototype.convertFrom = function (t) {
							var r = t.clone();
							return (r.red = null), r;
						}),
						(o.mont = function (t) {
							return new E(t);
						}),
						n(E, A),
						(E.prototype.convertTo = function (t) {
							return this.imod(t.ushln(this.shift));
						}),
						(E.prototype.convertFrom = function (t) {
							var r = this.imod(t.mul(this.rinv));
							return (r.red = null), r;
						}),
						(E.prototype.imul = function (t, r) {
							if (t.isZero() || r.isZero()) return (t.words[0] = 0), (t.length = 1), t;
							var i = t.imul(r),
								e = i.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
								n = i.isub(e).iushrn(this.shift),
								o = n;
							return (
								n.cmp(this.m) >= 0 ? (o = n.isub(this.m)) : n.cmpn(0) < 0 && (o = n.iadd(this.m)),
								o._forceRed(this)
							);
						}),
						(E.prototype.mul = function (t, r) {
							if (t.isZero() || r.isZero()) return new o(0)._forceRed(this);
							var i = t.mul(r),
								e = i.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
								n = i.isub(e).iushrn(this.shift),
								s = n;
							return (
								n.cmp(this.m) >= 0 ? (s = n.isub(this.m)) : n.cmpn(0) < 0 && (s = n.iadd(this.m)),
								s._forceRed(this)
							);
						}),
						(E.prototype.invm = function (t) {
							return this.imod(t._invmp(this.m).mul(this.r2))._forceRed(this);
						});
				})(t, this);
			}.call(this, i(0)(t)));
		},
		function (t, r, i) {
			(function (e, n) {
				var o;
				/**
				 * [js-sha3]{@link https://github.com/emn178/js-sha3}
				 *
				 * @version 0.8.0
				 * @author Chen, Yi-Cyuan [emn178@gmail.com]
				 * @copyright Chen, Yi-Cyuan 2015-2018
				 * @license MIT
				 */ !(function () {
					'use strict';
					var s = 'input is invalid type',
						h = 'object' == typeof window,
						u = h ? window : {};
					u.JS_SHA3_NO_WINDOW && (h = !1);
					var a = !h && 'object' == typeof self;
					!u.JS_SHA3_NO_NODE_JS && 'object' == typeof e && e.versions && e.versions.node
						? (u = n)
						: a && (u = self);
					var l = !u.JS_SHA3_NO_COMMON_JS && 'object' == typeof t && t.exports,
						f = i(31),
						m = !u.JS_SHA3_NO_ARRAY_BUFFER && 'undefined' != typeof ArrayBuffer,
						c = '0123456789abcdef'.split(''),
						d = [4, 1024, 262144, 67108864],
						p = [0, 8, 16, 24],
						g = [
							1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907, 0, 2147483649, 0,
							2147516545, 2147483648, 32777, 2147483648, 138, 0, 136, 0, 2147516425, 0, 2147483658,
							0, 2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771, 2147483648, 32770,
							2147483648, 128, 2147483648, 32778, 0, 2147483658, 2147483648, 2147516545, 2147483648,
							32896, 2147483648, 2147483649, 0, 2147516424, 2147483648,
						],
						v = [224, 256, 384, 512],
						y = [128, 256],
						w = ['hex', 'buffer', 'arrayBuffer', 'array', 'digest'],
						M = { 128: 168, 256: 136 };
					(!u.JS_SHA3_NO_NODE_JS && Array.isArray) ||
						(Array.isArray = function (t) {
							return '[object Array]' === Object.prototype.toString.call(t);
						}),
						!m ||
							(!u.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW && ArrayBuffer.isView) ||
							(ArrayBuffer.isView = function (t) {
								return 'object' == typeof t && t.buffer && t.buffer.constructor === ArrayBuffer;
							});
					for (
						var b = function (t, r, i) {
								return function (e) {
									return new j(t, r, t).update(e)[i]();
								};
							},
							_ = function (t, r, i) {
								return function (e, n) {
									return new j(t, r, n).update(e)[i]();
								};
							},
							A = function (t, r, i) {
								return function (r, e, n, o) {
									return T['cshake' + t].update(r, e, n, o)[i]();
								};
							},
							E = function (t, r, i) {
								return function (r, e, n, o) {
									return T['kmac' + t].update(r, e, n, o)[i]();
								};
							},
							x = function (t, r, i, e) {
								for (var n = 0; n < w.length; ++n) {
									var o = w[n];
									t[o] = r(i, e, o);
								}
								return t;
							},
							S = function (t, r) {
								var i = b(t, r, 'hex');
								return (
									(i.create = function () {
										return new j(t, r, t);
									}),
									(i.update = function (t) {
										return i.create().update(t);
									}),
									x(i, b, t, r)
								);
							},
							N = [
								{ name: 'keccak', padding: [1, 256, 65536, 16777216], bits: v, createMethod: S },
								{ name: 'sha3', padding: [6, 1536, 393216, 100663296], bits: v, createMethod: S },
								{
									name: 'shake',
									padding: [31, 7936, 2031616, 520093696],
									bits: y,
									createMethod: function (t, r) {
										var i = _(t, r, 'hex');
										return (
											(i.create = function (i) {
												return new j(t, r, i);
											}),
											(i.update = function (t, r) {
												return i.create(r).update(t);
											}),
											x(i, _, t, r)
										);
									},
								},
								{
									name: 'cshake',
									padding: d,
									bits: y,
									createMethod: function (t, r) {
										var i = M[t],
											e = A(t, 0, 'hex');
										return (
											(e.create = function (e, n, o) {
												return n || o
													? new j(t, r, e).bytepad([n, o], i)
													: T['shake' + t].create(e);
											}),
											(e.update = function (t, r, i, n) {
												return e.create(r, i, n).update(t);
											}),
											x(e, A, t, r)
										);
									},
								},
								{
									name: 'kmac',
									padding: d,
									bits: y,
									createMethod: function (t, r) {
										var i = M[t],
											e = E(t, 0, 'hex');
										return (
											(e.create = function (e, n, o) {
												return new P(t, r, n).bytepad(['KMAC', o], i).bytepad([e], i);
											}),
											(e.update = function (t, r, i, n) {
												return e.create(t, i, n).update(r);
											}),
											x(e, E, t, r)
										);
									},
								},
							],
							T = {},
							R = [],
							k = 0;
						k < N.length;
						++k
					)
						for (var I = N[k], B = I.bits, O = 0; O < B.length; ++O) {
							var C = I.name + '_' + B[O];
							if ((R.push(C), (T[C] = I.createMethod(B[O], I.padding)), 'sha3' !== I.name)) {
								var L = I.name + B[O];
								R.push(L), (T[L] = T[C]);
							}
						}
					function j(t, r, i) {
						(this.blocks = []),
							(this.s = []),
							(this.padding = r),
							(this.outputBits = i),
							(this.reset = !0),
							(this.finalized = !1),
							(this.block = 0),
							(this.start = 0),
							(this.blockCount = (1600 - (t << 1)) >> 5),
							(this.byteCount = this.blockCount << 2),
							(this.outputBlocks = i >> 5),
							(this.extraBytes = (31 & i) >> 3);
						for (var e = 0; e < 50; ++e) this.s[e] = 0;
					}
					function P(t, r, i) {
						j.call(this, t, r, i);
					}
					(j.prototype.update = function (t) {
						if (this.finalized) throw new Error('finalize already called');
						var r,
							i = typeof t;
						if ('string' !== i) {
							if ('object' !== i) throw new Error(s);
							if (null === t) throw new Error(s);
							if (m && t.constructor === ArrayBuffer) t = new Uint8Array(t);
							else if (!(Array.isArray(t) || (m && ArrayBuffer.isView(t)))) throw new Error(s);
							r = !0;
						}
						for (
							var e,
								n,
								o = this.blocks,
								h = this.byteCount,
								u = t.length,
								a = this.blockCount,
								l = 0,
								f = this.s;
							l < u;

						) {
							if (this.reset)
								for (this.reset = !1, o[0] = this.block, e = 1; e < a + 1; ++e) o[e] = 0;
							if (r) for (e = this.start; l < u && e < h; ++l) o[e >> 2] |= t[l] << p[3 & e++];
							else
								for (e = this.start; l < u && e < h; ++l)
									(n = t.charCodeAt(l)) < 128
										? (o[e >> 2] |= n << p[3 & e++])
										: n < 2048
										? ((o[e >> 2] |= (192 | (n >> 6)) << p[3 & e++]),
										  (o[e >> 2] |= (128 | (63 & n)) << p[3 & e++]))
										: n < 55296 || n >= 57344
										? ((o[e >> 2] |= (224 | (n >> 12)) << p[3 & e++]),
										  (o[e >> 2] |= (128 | ((n >> 6) & 63)) << p[3 & e++]),
										  (o[e >> 2] |= (128 | (63 & n)) << p[3 & e++]))
										: ((n = 65536 + (((1023 & n) << 10) | (1023 & t.charCodeAt(++l)))),
										  (o[e >> 2] |= (240 | (n >> 18)) << p[3 & e++]),
										  (o[e >> 2] |= (128 | ((n >> 12) & 63)) << p[3 & e++]),
										  (o[e >> 2] |= (128 | ((n >> 6) & 63)) << p[3 & e++]),
										  (o[e >> 2] |= (128 | (63 & n)) << p[3 & e++]));
							if (((this.lastByteIndex = e), e >= h)) {
								for (this.start = e - h, this.block = o[a], e = 0; e < a; ++e) f[e] ^= o[e];
								U(f), (this.reset = !0);
							} else this.start = e;
						}
						return this;
					}),
						(j.prototype.encode = function (t, r) {
							var i = 255 & t,
								e = 1,
								n = [i];
							for (i = 255 & (t >>= 8); i > 0; ) n.unshift(i), (i = 255 & (t >>= 8)), ++e;
							return r ? n.push(e) : n.unshift(e), this.update(n), n.length;
						}),
						(j.prototype.encodeString = function (t) {
							var r,
								i = typeof t;
							if ('string' !== i) {
								if ('object' !== i) throw new Error(s);
								if (null === t) throw new Error(s);
								if (m && t.constructor === ArrayBuffer) t = new Uint8Array(t);
								else if (!(Array.isArray(t) || (m && ArrayBuffer.isView(t)))) throw new Error(s);
								r = !0;
							}
							var e = 0,
								n = t.length;
							if (r) e = n;
							else
								for (var o = 0; o < t.length; ++o) {
									var h = t.charCodeAt(o);
									h < 128
										? (e += 1)
										: h < 2048
										? (e += 2)
										: h < 55296 || h >= 57344
										? (e += 3)
										: ((h = 65536 + (((1023 & h) << 10) | (1023 & t.charCodeAt(++o)))), (e += 4));
								}
							return (e += this.encode(8 * e)), this.update(t), e;
						}),
						(j.prototype.bytepad = function (t, r) {
							for (var i = this.encode(r), e = 0; e < t.length; ++e) i += this.encodeString(t[e]);
							var n = r - (i % r),
								o = [];
							return (o.length = n), this.update(o), this;
						}),
						(j.prototype.finalize = function () {
							if (!this.finalized) {
								this.finalized = !0;
								var t = this.blocks,
									r = this.lastByteIndex,
									i = this.blockCount,
									e = this.s;
								if (((t[r >> 2] |= this.padding[3 & r]), this.lastByteIndex === this.byteCount))
									for (t[0] = t[i], r = 1; r < i + 1; ++r) t[r] = 0;
								for (t[i - 1] |= 2147483648, r = 0; r < i; ++r) e[r] ^= t[r];
								U(e);
							}
						}),
						(j.prototype.toString = j.prototype.hex =
							function () {
								this.finalize();
								for (
									var t,
										r = this.blockCount,
										i = this.s,
										e = this.outputBlocks,
										n = this.extraBytes,
										o = 0,
										s = 0,
										h = '';
									s < e;

								) {
									for (o = 0; o < r && s < e; ++o, ++s)
										(t = i[o]),
											(h +=
												c[(t >> 4) & 15] +
												c[15 & t] +
												c[(t >> 12) & 15] +
												c[(t >> 8) & 15] +
												c[(t >> 20) & 15] +
												c[(t >> 16) & 15] +
												c[(t >> 28) & 15] +
												c[(t >> 24) & 15]);
									s % r == 0 && (U(i), (o = 0));
								}
								return (
									n &&
										((t = i[o]),
										(h += c[(t >> 4) & 15] + c[15 & t]),
										n > 1 && (h += c[(t >> 12) & 15] + c[(t >> 8) & 15]),
										n > 2 && (h += c[(t >> 20) & 15] + c[(t >> 16) & 15])),
									h
								);
							}),
						(j.prototype.arrayBuffer = function () {
							this.finalize();
							var t,
								r = this.blockCount,
								i = this.s,
								e = this.outputBlocks,
								n = this.extraBytes,
								o = 0,
								s = 0,
								h = this.outputBits >> 3;
							t = n ? new ArrayBuffer((e + 1) << 2) : new ArrayBuffer(h);
							for (var u = new Uint32Array(t); s < e; ) {
								for (o = 0; o < r && s < e; ++o, ++s) u[s] = i[o];
								s % r == 0 && U(i);
							}
							return n && ((u[o] = i[o]), (t = t.slice(0, h))), t;
						}),
						(j.prototype.buffer = j.prototype.arrayBuffer),
						(j.prototype.digest = j.prototype.array =
							function () {
								this.finalize();
								for (
									var t,
										r,
										i = this.blockCount,
										e = this.s,
										n = this.outputBlocks,
										o = this.extraBytes,
										s = 0,
										h = 0,
										u = [];
									h < n;

								) {
									for (s = 0; s < i && h < n; ++s, ++h)
										(t = h << 2),
											(r = e[s]),
											(u[t] = 255 & r),
											(u[t + 1] = (r >> 8) & 255),
											(u[t + 2] = (r >> 16) & 255),
											(u[t + 3] = (r >> 24) & 255);
									h % i == 0 && U(e);
								}
								return (
									o &&
										((t = h << 2),
										(r = e[s]),
										(u[t] = 255 & r),
										o > 1 && (u[t + 1] = (r >> 8) & 255),
										o > 2 && (u[t + 2] = (r >> 16) & 255)),
									u
								);
							}),
						(P.prototype = new j()),
						(P.prototype.finalize = function () {
							return this.encode(this.outputBits, !0), j.prototype.finalize.call(this);
						});
					var U = function (t) {
						var r,
							i,
							e,
							n,
							o,
							s,
							h,
							u,
							a,
							l,
							f,
							m,
							c,
							d,
							p,
							v,
							y,
							w,
							M,
							b,
							_,
							A,
							E,
							x,
							S,
							N,
							T,
							R,
							k,
							I,
							B,
							O,
							C,
							L,
							j,
							P,
							U,
							F,
							D,
							Z,
							z,
							q,
							H,
							W,
							G,
							Y,
							$,
							V,
							J,
							K,
							X,
							Q,
							tt,
							rt,
							it,
							et,
							nt,
							ot,
							st,
							ht,
							ut,
							at,
							lt;
						for (e = 0; e < 48; e += 2)
							(n = t[0] ^ t[10] ^ t[20] ^ t[30] ^ t[40]),
								(o = t[1] ^ t[11] ^ t[21] ^ t[31] ^ t[41]),
								(s = t[2] ^ t[12] ^ t[22] ^ t[32] ^ t[42]),
								(h = t[3] ^ t[13] ^ t[23] ^ t[33] ^ t[43]),
								(u = t[4] ^ t[14] ^ t[24] ^ t[34] ^ t[44]),
								(a = t[5] ^ t[15] ^ t[25] ^ t[35] ^ t[45]),
								(l = t[6] ^ t[16] ^ t[26] ^ t[36] ^ t[46]),
								(f = t[7] ^ t[17] ^ t[27] ^ t[37] ^ t[47]),
								(r = (m = t[8] ^ t[18] ^ t[28] ^ t[38] ^ t[48]) ^ ((s << 1) | (h >>> 31))),
								(i = (c = t[9] ^ t[19] ^ t[29] ^ t[39] ^ t[49]) ^ ((h << 1) | (s >>> 31))),
								(t[0] ^= r),
								(t[1] ^= i),
								(t[10] ^= r),
								(t[11] ^= i),
								(t[20] ^= r),
								(t[21] ^= i),
								(t[30] ^= r),
								(t[31] ^= i),
								(t[40] ^= r),
								(t[41] ^= i),
								(r = n ^ ((u << 1) | (a >>> 31))),
								(i = o ^ ((a << 1) | (u >>> 31))),
								(t[2] ^= r),
								(t[3] ^= i),
								(t[12] ^= r),
								(t[13] ^= i),
								(t[22] ^= r),
								(t[23] ^= i),
								(t[32] ^= r),
								(t[33] ^= i),
								(t[42] ^= r),
								(t[43] ^= i),
								(r = s ^ ((l << 1) | (f >>> 31))),
								(i = h ^ ((f << 1) | (l >>> 31))),
								(t[4] ^= r),
								(t[5] ^= i),
								(t[14] ^= r),
								(t[15] ^= i),
								(t[24] ^= r),
								(t[25] ^= i),
								(t[34] ^= r),
								(t[35] ^= i),
								(t[44] ^= r),
								(t[45] ^= i),
								(r = u ^ ((m << 1) | (c >>> 31))),
								(i = a ^ ((c << 1) | (m >>> 31))),
								(t[6] ^= r),
								(t[7] ^= i),
								(t[16] ^= r),
								(t[17] ^= i),
								(t[26] ^= r),
								(t[27] ^= i),
								(t[36] ^= r),
								(t[37] ^= i),
								(t[46] ^= r),
								(t[47] ^= i),
								(r = l ^ ((n << 1) | (o >>> 31))),
								(i = f ^ ((o << 1) | (n >>> 31))),
								(t[8] ^= r),
								(t[9] ^= i),
								(t[18] ^= r),
								(t[19] ^= i),
								(t[28] ^= r),
								(t[29] ^= i),
								(t[38] ^= r),
								(t[39] ^= i),
								(t[48] ^= r),
								(t[49] ^= i),
								(d = t[0]),
								(p = t[1]),
								(Y = (t[11] << 4) | (t[10] >>> 28)),
								($ = (t[10] << 4) | (t[11] >>> 28)),
								(R = (t[20] << 3) | (t[21] >>> 29)),
								(k = (t[21] << 3) | (t[20] >>> 29)),
								(ht = (t[31] << 9) | (t[30] >>> 23)),
								(ut = (t[30] << 9) | (t[31] >>> 23)),
								(q = (t[40] << 18) | (t[41] >>> 14)),
								(H = (t[41] << 18) | (t[40] >>> 14)),
								(L = (t[2] << 1) | (t[3] >>> 31)),
								(j = (t[3] << 1) | (t[2] >>> 31)),
								(v = (t[13] << 12) | (t[12] >>> 20)),
								(y = (t[12] << 12) | (t[13] >>> 20)),
								(V = (t[22] << 10) | (t[23] >>> 22)),
								(J = (t[23] << 10) | (t[22] >>> 22)),
								(I = (t[33] << 13) | (t[32] >>> 19)),
								(B = (t[32] << 13) | (t[33] >>> 19)),
								(at = (t[42] << 2) | (t[43] >>> 30)),
								(lt = (t[43] << 2) | (t[42] >>> 30)),
								(rt = (t[5] << 30) | (t[4] >>> 2)),
								(it = (t[4] << 30) | (t[5] >>> 2)),
								(P = (t[14] << 6) | (t[15] >>> 26)),
								(U = (t[15] << 6) | (t[14] >>> 26)),
								(w = (t[25] << 11) | (t[24] >>> 21)),
								(M = (t[24] << 11) | (t[25] >>> 21)),
								(K = (t[34] << 15) | (t[35] >>> 17)),
								(X = (t[35] << 15) | (t[34] >>> 17)),
								(O = (t[45] << 29) | (t[44] >>> 3)),
								(C = (t[44] << 29) | (t[45] >>> 3)),
								(x = (t[6] << 28) | (t[7] >>> 4)),
								(S = (t[7] << 28) | (t[6] >>> 4)),
								(et = (t[17] << 23) | (t[16] >>> 9)),
								(nt = (t[16] << 23) | (t[17] >>> 9)),
								(F = (t[26] << 25) | (t[27] >>> 7)),
								(D = (t[27] << 25) | (t[26] >>> 7)),
								(b = (t[36] << 21) | (t[37] >>> 11)),
								(_ = (t[37] << 21) | (t[36] >>> 11)),
								(Q = (t[47] << 24) | (t[46] >>> 8)),
								(tt = (t[46] << 24) | (t[47] >>> 8)),
								(W = (t[8] << 27) | (t[9] >>> 5)),
								(G = (t[9] << 27) | (t[8] >>> 5)),
								(N = (t[18] << 20) | (t[19] >>> 12)),
								(T = (t[19] << 20) | (t[18] >>> 12)),
								(ot = (t[29] << 7) | (t[28] >>> 25)),
								(st = (t[28] << 7) | (t[29] >>> 25)),
								(Z = (t[38] << 8) | (t[39] >>> 24)),
								(z = (t[39] << 8) | (t[38] >>> 24)),
								(A = (t[48] << 14) | (t[49] >>> 18)),
								(E = (t[49] << 14) | (t[48] >>> 18)),
								(t[0] = d ^ (~v & w)),
								(t[1] = p ^ (~y & M)),
								(t[10] = x ^ (~N & R)),
								(t[11] = S ^ (~T & k)),
								(t[20] = L ^ (~P & F)),
								(t[21] = j ^ (~U & D)),
								(t[30] = W ^ (~Y & V)),
								(t[31] = G ^ (~$ & J)),
								(t[40] = rt ^ (~et & ot)),
								(t[41] = it ^ (~nt & st)),
								(t[2] = v ^ (~w & b)),
								(t[3] = y ^ (~M & _)),
								(t[12] = N ^ (~R & I)),
								(t[13] = T ^ (~k & B)),
								(t[22] = P ^ (~F & Z)),
								(t[23] = U ^ (~D & z)),
								(t[32] = Y ^ (~V & K)),
								(t[33] = $ ^ (~J & X)),
								(t[42] = et ^ (~ot & ht)),
								(t[43] = nt ^ (~st & ut)),
								(t[4] = w ^ (~b & A)),
								(t[5] = M ^ (~_ & E)),
								(t[14] = R ^ (~I & O)),
								(t[15] = k ^ (~B & C)),
								(t[24] = F ^ (~Z & q)),
								(t[25] = D ^ (~z & H)),
								(t[34] = V ^ (~K & Q)),
								(t[35] = J ^ (~X & tt)),
								(t[44] = ot ^ (~ht & at)),
								(t[45] = st ^ (~ut & lt)),
								(t[6] = b ^ (~A & d)),
								(t[7] = _ ^ (~E & p)),
								(t[16] = I ^ (~O & x)),
								(t[17] = B ^ (~C & S)),
								(t[26] = Z ^ (~q & L)),
								(t[27] = z ^ (~H & j)),
								(t[36] = K ^ (~Q & W)),
								(t[37] = X ^ (~tt & G)),
								(t[46] = ht ^ (~at & rt)),
								(t[47] = ut ^ (~lt & it)),
								(t[8] = A ^ (~d & v)),
								(t[9] = E ^ (~p & y)),
								(t[18] = O ^ (~x & N)),
								(t[19] = C ^ (~S & T)),
								(t[28] = q ^ (~L & P)),
								(t[29] = H ^ (~j & U)),
								(t[38] = Q ^ (~W & Y)),
								(t[39] = tt ^ (~G & $)),
								(t[48] = at ^ (~rt & et)),
								(t[49] = lt ^ (~it & nt)),
								(t[0] ^= g[e]),
								(t[1] ^= g[e + 1]);
					};
					if (l) t.exports = T;
					else {
						for (k = 0; k < R.length; ++k) u[R[k]] = T[R[k]];
						f &&
							(void 0 ===
								(o = function () {
									return T;
								}.call(r, i, r, t)) ||
								(t.exports = o));
					}
				})();
			}.call(this, i(14), i(3)));
		},
		function (t, r, i) {
			var e = i(4),
				n = i(9),
				o = i(10),
				s = i(32),
				h = i(15),
				u = function (t, r) {
					var i = [];
					return (
						r.forEach(function (r) {
							if ('object' == typeof r.components) {
								if ('tuple' !== r.type.substring(0, 5))
									throw new Error('components found but type is not tuple; report on GitHub');
								var n = '',
									o = r.type.indexOf('[');
								o >= 0 && (n = r.type.substring(o));
								var s = u(t, r.components);
								e.isArray(s) && t
									? i.push('tuple(' + s.join(',') + ')' + n)
									: t
									? i.push('(' + s + ')')
									: i.push('(' + s.join(',') + ')' + n);
							} else i.push(r.type);
						}),
						i
					);
				},
				a = function (t) {
					if (!o.isHexStrict(t)) throw new Error('The parameter must be a valid HEX string.');
					var r = '',
						i = 0,
						e = t.length;
					for ('0x' === t.substring(0, 2) && (i = 2); i < e; i += 2) {
						var n = parseInt(t.substr(i, 2), 16);
						r += String.fromCharCode(n);
					}
					return r;
				},
				l = function (t) {
					if (!t) return '0x00';
					for (var r = '', i = 0; i < t.length; i++) {
						var e = t.charCodeAt(i).toString(16);
						r += e.length < 2 ? '0' + e : e;
					}
					return '0x' + r;
				},
				f = function (t) {
					if (((t = t ? t.toLowerCase() : 'ether'), !n.unitMap[t]))
						throw new Error(
							'This unit "' +
								t +
								'" doesn\'t exist, please use the one of the following units' +
								JSON.stringify(n.unitMap, null, 2)
						);
					return t;
				};
			t.exports = {
				_fireError: function (t, r, i, n, o) {
					return (
						!e.isObject(t) ||
							t instanceof Error ||
							!t.data ||
							((e.isObject(t.data) || e.isArray(t.data)) &&
								(t.data = JSON.stringify(t.data, null, 2)),
							(t = t.message + '\n' + t.data)),
						e.isString(t) && (t = new Error(t)),
						e.isFunction(n) && n(t, o),
						e.isFunction(i) &&
							(((r && e.isFunction(r.listeners) && r.listeners('error').length) ||
								e.isFunction(n)) &&
								r.catch(function () {}),
							setTimeout(function () {
								i(t);
							}, 1)),
						r &&
							e.isFunction(r.emit) &&
							setTimeout(function () {
								r.emit('error', t, o), r.removeAllListeners();
							}, 1),
						r
					);
				},
				_jsonInterfaceMethodToString: function (t) {
					return e.isObject(t) && t.name && -1 !== t.name.indexOf('(')
						? t.name
						: t.name + '(' + u(!1, t.inputs).join(',') + ')';
				},
				_flattenTypes: u,
				randomHex: function (t) {
					return '0x' + h(t).toString('hex');
				},
				_: e,
				BN: o.BN,
				isBN: o.isBN,
				isBigNumber: o.isBigNumber,
				isHex: o.isHex,
				isHexStrict: o.isHexStrict,
				sha3: o.sha3,
				keccak256: o.sha3,
				soliditySha3: s,
				isAddress: o.isAddress,
				checkAddressChecksum: o.checkAddressChecksum,
				toChecksumAddress: function (t) {
					if (void 0 === t) return '';
					if (!/^(0x)?[0-9a-f]{40}$/i.test(t))
						throw new Error('Given address "' + t + '" is not a valid Ethereum address.');
					t = t.toLowerCase().replace(/^0x/i, '');
					for (var r = o.sha3(t).replace(/^0x/i, ''), i = '0x', e = 0; e < t.length; e++)
						parseInt(r[e], 16) > 7 ? (i += t[e].toUpperCase()) : (i += t[e]);
					return i;
				},
				toHex: o.toHex,
				toBN: o.toBN,
				bytesToHex: o.bytesToHex,
				hexToBytes: o.hexToBytes,
				hexToNumberString: o.hexToNumberString,
				hexToNumber: o.hexToNumber,
				toDecimal: o.hexToNumber,
				numberToHex: o.numberToHex,
				fromDecimal: o.numberToHex,
				hexToUtf8: o.hexToUtf8,
				hexToString: o.hexToUtf8,
				toUtf8: o.hexToUtf8,
				utf8ToHex: o.utf8ToHex,
				stringToHex: o.utf8ToHex,
				fromUtf8: o.utf8ToHex,
				hexToAscii: a,
				toAscii: a,
				asciiToHex: l,
				fromAscii: l,
				unitMap: n.unitMap,
				toWei: function (t, r) {
					if (((r = f(r)), !o.isBN(t) && !e.isString(t)))
						throw new Error(
							'Please pass numbers as strings or BN objects to avoid precision errors.'
						);
					return o.isBN(t) ? n.toWei(t, r) : n.toWei(t, r).toString(10);
				},
				fromWei: function (t, r) {
					if (((r = f(r)), !o.isBN(t) && !e.isString(t)))
						throw new Error(
							'Please pass numbers as strings or BN objects to avoid precision errors.'
						);
					return o.isBN(t) ? n.fromWei(t, r) : n.fromWei(t, r).toString(10);
				},
				padLeft: o.leftPad,
				leftPad: o.leftPad,
				padRight: o.rightPad,
				rightPad: o.rightPad,
				toTwosComplement: o.toTwosComplement,
			};
		},
		function (t, r, i) {
			'use strict';
			var e = i(21),
				n = i(5),
				o = new e(0),
				s = new e(-1),
				h = {
					noether: '0',
					wei: '1',
					kwei: '1000',
					Kwei: '1000',
					babbage: '1000',
					femtoether: '1000',
					mwei: '1000000',
					Mwei: '1000000',
					lovelace: '1000000',
					picoether: '1000000',
					gwei: '1000000000',
					Gwei: '1000000000',
					shannon: '1000000000',
					nanoether: '1000000000',
					nano: '1000000000',
					szabo: '1000000000000',
					microether: '1000000000000',
					micro: '1000000000000',
					finney: '1000000000000000',
					milliether: '1000000000000000',
					milli: '1000000000000000',
					ether: '1000000000000000000',
					kether: '1000000000000000000000',
					grand: '1000000000000000000000',
					mether: '1000000000000000000000000',
					gether: '1000000000000000000000000000',
					tether: '1000000000000000000000000000000',
				};
			function u(t) {
				var r = t ? t.toLowerCase() : 'ether',
					i = h[r];
				if ('string' != typeof i)
					throw new Error(
						'[ethjs-unit] the unit provided ' +
							t +
							" doesn't exists, please use the one of the following units " +
							JSON.stringify(h, null, 2)
					);
				return new e(i, 10);
			}
			function a(t) {
				if ('string' == typeof t) {
					if (!t.match(/^-?[0-9.]+$/))
						throw new Error(
							"while converting number to string, invalid number value '" +
								t +
								"', should be a number matching (^-?[0-9.]+)."
						);
					return t;
				}
				if ('number' == typeof t) return String(t);
				if ('object' == typeof t && t.toString && (t.toTwos || t.dividedToIntegerBy))
					return t.toPrecision ? String(t.toPrecision()) : t.toString(10);
				throw new Error(
					"while converting number to string, invalid number value '" +
						t +
						"' type " +
						typeof t +
						'.'
				);
			}
			t.exports = {
				unitMap: h,
				numberToString: a,
				getValueOfUnit: u,
				fromWei: function (t, r, i) {
					var e = n(t),
						a = e.lt(o),
						l = u(r),
						f = h[r].length - 1 || 1,
						m = i || {};
					a && (e = e.mul(s));
					for (var c = e.mod(l).toString(10); c.length < f; ) c = '0' + c;
					m.pad || (c = c.match(/^([0-9]*[1-9]|0)(0*)/)[1]);
					var d = e.div(l).toString(10);
					m.commify && (d = d.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
					var p = d + ('0' == c ? '' : '.' + c);
					return a && (p = '-' + p), p;
				},
				toWei: function (t, r) {
					var i = a(t),
						n = u(r),
						o = h[r].length - 1 || 1,
						l = '-' === i.substring(0, 1);
					if ((l && (i = i.substring(1)), '.' === i))
						throw new Error('[ethjs-unit] while converting number ' + t + ' to wei, invalid value');
					var f = i.split('.');
					if (f.length > 2)
						throw new Error(
							'[ethjs-unit] while converting number ' + t + ' to wei,  too many decimal points'
						);
					var m = f[0],
						c = f[1];
					if ((m || (m = '0'), c || (c = '0'), c.length > o))
						throw new Error(
							'[ethjs-unit] while converting number ' + t + ' to wei, too many decimal places'
						);
					for (; c.length < o; ) c += '0';
					(m = new e(m)), (c = new e(c));
					var d = m.mul(n).add(c);
					return l && (d = d.mul(s)), new e(d.toString(10), 10);
				},
			};
		},
		function (t, r, i) {
			(function (r) {
				var e = i(4),
					n = i(11),
					o = i(5),
					s = i(12),
					h = i(29),
					u = i(13),
					a = function (t) {
						return n.isBN(t);
					},
					l = function (t) {
						return t && t.constructor && 'BigNumber' === t.constructor.name;
					},
					f = function (t) {
						try {
							return o.apply(null, arguments);
						} catch (r) {
							throw new Error(r + ' Given value: "' + t + '"');
						}
					},
					m = function (t) {
						return (
							!!/^(0x)?[0-9a-f]{40}$/i.test(t) &&
							(!(!/^(0x|0X)?[0-9a-f]{40}$/.test(t) && !/^(0x|0X)?[0-9A-F]{40}$/.test(t)) || c(t))
						);
					},
					c = function (t) {
						t = t.replace(/^0x/i, '');
						for (var r = y(t.toLowerCase()).replace(/^0x/i, ''), i = 0; i < 40; i++)
							if (
								(parseInt(r[i], 16) > 7 && t[i].toUpperCase() !== t[i]) ||
								(parseInt(r[i], 16) <= 7 && t[i].toLowerCase() !== t[i])
							)
								return !1;
						return !0;
					},
					d = function (t) {
						var r = '';
						t = (t = (t = (t = (t = s.encode(t)).replace(/^(?:\u0000)*/, ''))
							.split('')
							.reverse()
							.join('')).replace(/^(?:\u0000)*/, ''))
							.split('')
							.reverse()
							.join('');
						for (var i = 0; i < t.length; i++) {
							var e = t.charCodeAt(i).toString(16);
							r += e.length < 2 ? '0' + e : e;
						}
						return '0x' + r;
					},
					p = function (t) {
						if (e.isNull(t) || e.isUndefined(t)) return t;
						if (!isFinite(t) && !v(t)) throw new Error('Given input "' + t + '" is not a number.');
						var r = f(t),
							i = r.toString(16);
						return r.lt(new n(0)) ? '-0x' + i.substr(1) : '0x' + i;
					},
					g = function (t) {
						if (((t = t.toString(16)), !v(t)))
							throw new Error('Given value "' + t + '" is not a valid hex string.');
						t = t.replace(/^0x/i, '');
						for (var r = [], i = 0; i < t.length; i += 2) r.push(parseInt(t.substr(i, 2), 16));
						return r;
					},
					v = function (t) {
						return (e.isString(t) || e.isNumber(t)) && /^(-)?0x[0-9a-f]*$/i.test(t);
					},
					y = function (t) {
						a(t) && (t = t.toString()), v(t) && /^0x/i.test(t.toString()) && (t = g(t));
						var r = h.keccak256(t);
						return '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470' === r
							? null
							: r;
					};
				(y._Hash = h),
					(t.exports = {
						BN: n,
						isBN: a,
						isBigNumber: l,
						toBN: f,
						isAddress: m,
						isBloom: function (t) {
							return u.isBloom(t);
						},
						isUserEthereumAddressInBloom: function (t, r) {
							return u.isUserEthereumAddressInBloom(t, r);
						},
						isContractAddressInBloom: function (t, r) {
							return u.isContractAddressInBloom(t, r);
						},
						isTopic: function (t) {
							return u.isTopic(t);
						},
						isTopicInBloom: function (t, r) {
							return u.isTopicInBloom(t, r);
						},
						isInBloom: function (t, r) {
							return u.isInBloom(t, r);
						},
						checkAddressChecksum: c,
						utf8ToHex: d,
						hexToUtf8: function (t) {
							if (!v(t)) throw new Error('The parameter "' + t + '" must be a valid HEX string.');
							for (
								var r = '',
									i = 0,
									e = (t = (t = (t = (t = (t = t.replace(/^0x/i, '')).replace(/^(?:00)*/, ''))
										.split('')
										.reverse()
										.join('')).replace(/^(?:00)*/, ''))
										.split('')
										.reverse()
										.join('')).length,
									n = 0;
								n < e;
								n += 2
							)
								(i = parseInt(t.substr(n, 2), 16)), (r += String.fromCharCode(i));
							return s.decode(r);
						},
						hexToNumber: function (t) {
							if (!t) return t;
							if (e.isString(t) && !v(t))
								throw new Error('Given value "' + t + '" is not a valid hex string.');
							return f(t).toNumber();
						},
						hexToNumberString: function (t) {
							if (!t) return t;
							if (e.isString(t) && !v(t))
								throw new Error('Given value "' + t + '" is not a valid hex string.');
							return f(t).toString(10);
						},
						numberToHex: p,
						toHex: function (t, i) {
							if (m(t)) return i ? 'address' : '0x' + t.toLowerCase().replace(/^0x/i, '');
							if (e.isBoolean(t)) return i ? 'bool' : t ? '0x01' : '0x00';
							if (r.isBuffer(t)) return '0x' + t.toString('hex');
							if (e.isObject(t) && !l(t) && !a(t)) return i ? 'string' : d(JSON.stringify(t));
							if (e.isString(t)) {
								if (0 === t.indexOf('-0x') || 0 === t.indexOf('-0X')) return i ? 'int256' : p(t);
								if (0 === t.indexOf('0x') || 0 === t.indexOf('0X')) return i ? 'bytes' : t;
								if (!isFinite(t)) return i ? 'string' : d(t);
							}
							return i ? (t < 0 ? 'int256' : 'uint256') : p(t);
						},
						hexToBytes: g,
						bytesToHex: function (t) {
							for (var r = [], i = 0; i < t.length; i++)
								r.push((t[i] >>> 4).toString(16)), r.push((15 & t[i]).toString(16));
							return '0x' + r.join('');
						},
						isHex: function (t) {
							return (e.isString(t) || e.isNumber(t)) && /^(-0x|0x)?[0-9a-f]*$/i.test(t);
						},
						isHexStrict: v,
						leftPad: function (t, r, i) {
							var e = /^0x/i.test(t) || 'number' == typeof t,
								n =
									r - (t = t.toString(16).replace(/^0x/i, '')).length + 1 >= 0
										? r - t.length + 1
										: 0;
							return (e ? '0x' : '') + new Array(n).join(i || '0') + t;
						},
						rightPad: function (t, r, i) {
							var e = /^0x/i.test(t) || 'number' == typeof t,
								n =
									r - (t = t.toString(16).replace(/^0x/i, '')).length + 1 >= 0
										? r - t.length + 1
										: 0;
							return (e ? '0x' : '') + t + new Array(n).join(i || '0');
						},
						toTwosComplement: function (t) {
							return '0x' + f(t).toTwos(256).toString(16, 64);
						},
						sha3: y,
					});
			}.call(this, i(1).Buffer));
		},
		function (t, r, i) {
			(function (t) {
				!(function (t, r) {
					'use strict';
					function e(t, r) {
						if (!t) throw new Error(r || 'Assertion failed');
					}
					function n(t, r) {
						t.super_ = r;
						var i = function () {};
						(i.prototype = r.prototype), (t.prototype = new i()), (t.prototype.constructor = t);
					}
					function o(t, r, i) {
						if (o.isBN(t)) return t;
						(this.negative = 0),
							(this.words = null),
							(this.length = 0),
							(this.red = null),
							null !== t &&
								(('le' !== r && 'be' !== r) || ((i = r), (r = 10)),
								this._init(t || 0, r || 10, i || 'be'));
					}
					var s;
					'object' == typeof t ? (t.exports = o) : (r.BN = o), (o.BN = o), (o.wordSize = 26);
					try {
						s = i(28).Buffer;
					} catch (t) {}
					function h(t, r, i) {
						for (var e = 0, n = Math.min(t.length, i), o = r; o < n; o++) {
							var s = t.charCodeAt(o) - 48;
							(e <<= 4),
								(e |= s >= 49 && s <= 54 ? s - 49 + 10 : s >= 17 && s <= 22 ? s - 17 + 10 : 15 & s);
						}
						return e;
					}
					function u(t, r, i, e) {
						for (var n = 0, o = Math.min(t.length, i), s = r; s < o; s++) {
							var h = t.charCodeAt(s) - 48;
							(n *= e), (n += h >= 49 ? h - 49 + 10 : h >= 17 ? h - 17 + 10 : h);
						}
						return n;
					}
					(o.isBN = function (t) {
						return (
							t instanceof o ||
							(null !== t &&
								'object' == typeof t &&
								t.constructor.wordSize === o.wordSize &&
								Array.isArray(t.words))
						);
					}),
						(o.max = function (t, r) {
							return t.cmp(r) > 0 ? t : r;
						}),
						(o.min = function (t, r) {
							return t.cmp(r) < 0 ? t : r;
						}),
						(o.prototype._init = function (t, r, i) {
							if ('number' == typeof t) return this._initNumber(t, r, i);
							if ('object' == typeof t) return this._initArray(t, r, i);
							'hex' === r && (r = 16), e(r === (0 | r) && r >= 2 && r <= 36);
							var n = 0;
							'-' === (t = t.toString().replace(/\s+/g, ''))[0] && n++,
								16 === r ? this._parseHex(t, n) : this._parseBase(t, r, n),
								'-' === t[0] && (this.negative = 1),
								this.strip(),
								'le' === i && this._initArray(this.toArray(), r, i);
						}),
						(o.prototype._initNumber = function (t, r, i) {
							t < 0 && ((this.negative = 1), (t = -t)),
								t < 67108864
									? ((this.words = [67108863 & t]), (this.length = 1))
									: t < 4503599627370496
									? ((this.words = [67108863 & t, (t / 67108864) & 67108863]), (this.length = 2))
									: (e(t < 9007199254740992),
									  (this.words = [67108863 & t, (t / 67108864) & 67108863, 1]),
									  (this.length = 3)),
								'le' === i && this._initArray(this.toArray(), r, i);
						}),
						(o.prototype._initArray = function (t, r, i) {
							if ((e('number' == typeof t.length), t.length <= 0))
								return (this.words = [0]), (this.length = 1), this;
							(this.length = Math.ceil(t.length / 3)), (this.words = new Array(this.length));
							for (var n = 0; n < this.length; n++) this.words[n] = 0;
							var o,
								s,
								h = 0;
							if ('be' === i)
								for (n = t.length - 1, o = 0; n >= 0; n -= 3)
									(s = t[n] | (t[n - 1] << 8) | (t[n - 2] << 16)),
										(this.words[o] |= (s << h) & 67108863),
										(this.words[o + 1] = (s >>> (26 - h)) & 67108863),
										(h += 24) >= 26 && ((h -= 26), o++);
							else if ('le' === i)
								for (n = 0, o = 0; n < t.length; n += 3)
									(s = t[n] | (t[n + 1] << 8) | (t[n + 2] << 16)),
										(this.words[o] |= (s << h) & 67108863),
										(this.words[o + 1] = (s >>> (26 - h)) & 67108863),
										(h += 24) >= 26 && ((h -= 26), o++);
							return this.strip();
						}),
						(o.prototype._parseHex = function (t, r) {
							(this.length = Math.ceil((t.length - r) / 6)), (this.words = new Array(this.length));
							for (var i = 0; i < this.length; i++) this.words[i] = 0;
							var e,
								n,
								o = 0;
							for (i = t.length - 6, e = 0; i >= r; i -= 6)
								(n = h(t, i, i + 6)),
									(this.words[e] |= (n << o) & 67108863),
									(this.words[e + 1] |= (n >>> (26 - o)) & 4194303),
									(o += 24) >= 26 && ((o -= 26), e++);
							i + 6 !== r &&
								((n = h(t, r, i + 6)),
								(this.words[e] |= (n << o) & 67108863),
								(this.words[e + 1] |= (n >>> (26 - o)) & 4194303)),
								this.strip();
						}),
						(o.prototype._parseBase = function (t, r, i) {
							(this.words = [0]), (this.length = 1);
							for (var e = 0, n = 1; n <= 67108863; n *= r) e++;
							e--, (n = (n / r) | 0);
							for (
								var o = t.length - i, s = o % e, h = Math.min(o, o - s) + i, a = 0, l = i;
								l < h;
								l += e
							)
								(a = u(t, l, l + e, r)),
									this.imuln(n),
									this.words[0] + a < 67108864 ? (this.words[0] += a) : this._iaddn(a);
							if (0 !== s) {
								var f = 1;
								for (a = u(t, l, t.length, r), l = 0; l < s; l++) f *= r;
								this.imuln(f), this.words[0] + a < 67108864 ? (this.words[0] += a) : this._iaddn(a);
							}
						}),
						(o.prototype.copy = function (t) {
							t.words = new Array(this.length);
							for (var r = 0; r < this.length; r++) t.words[r] = this.words[r];
							(t.length = this.length), (t.negative = this.negative), (t.red = this.red);
						}),
						(o.prototype.clone = function () {
							var t = new o(null);
							return this.copy(t), t;
						}),
						(o.prototype._expand = function (t) {
							for (; this.length < t; ) this.words[this.length++] = 0;
							return this;
						}),
						(o.prototype.strip = function () {
							for (; this.length > 1 && 0 === this.words[this.length - 1]; ) this.length--;
							return this._normSign();
						}),
						(o.prototype._normSign = function () {
							return 1 === this.length && 0 === this.words[0] && (this.negative = 0), this;
						}),
						(o.prototype.inspect = function () {
							return (this.red ? '<BN-R: ' : '<BN: ') + this.toString(16) + '>';
						});
					var a = [
							'',
							'0',
							'00',
							'000',
							'0000',
							'00000',
							'000000',
							'0000000',
							'00000000',
							'000000000',
							'0000000000',
							'00000000000',
							'000000000000',
							'0000000000000',
							'00000000000000',
							'000000000000000',
							'0000000000000000',
							'00000000000000000',
							'000000000000000000',
							'0000000000000000000',
							'00000000000000000000',
							'000000000000000000000',
							'0000000000000000000000',
							'00000000000000000000000',
							'000000000000000000000000',
							'0000000000000000000000000',
						],
						l = [
							0, 0, 25, 16, 12, 11, 10, 9, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5,
							5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
						],
						f = [
							0, 0, 33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216, 43046721,
							1e7, 19487171, 35831808, 62748517, 7529536, 11390625, 16777216, 24137569, 34012224,
							47045881, 64e6, 4084101, 5153632, 6436343, 7962624, 9765625, 11881376, 14348907,
							17210368, 20511149, 243e5, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176,
						];
					function m(t, r, i) {
						i.negative = r.negative ^ t.negative;
						var e = (t.length + r.length) | 0;
						(i.length = e), (e = (e - 1) | 0);
						var n = 0 | t.words[0],
							o = 0 | r.words[0],
							s = n * o,
							h = 67108863 & s,
							u = (s / 67108864) | 0;
						i.words[0] = h;
						for (var a = 1; a < e; a++) {
							for (
								var l = u >>> 26,
									f = 67108863 & u,
									m = Math.min(a, r.length - 1),
									c = Math.max(0, a - t.length + 1);
								c <= m;
								c++
							) {
								var d = (a - c) | 0;
								(l += ((s = (n = 0 | t.words[d]) * (o = 0 | r.words[c]) + f) / 67108864) | 0),
									(f = 67108863 & s);
							}
							(i.words[a] = 0 | f), (u = 0 | l);
						}
						return 0 !== u ? (i.words[a] = 0 | u) : i.length--, i.strip();
					}
					(o.prototype.toString = function (t, r) {
						var i;
						if (((r = 0 | r || 1), 16 === (t = t || 10) || 'hex' === t)) {
							i = '';
							for (var n = 0, o = 0, s = 0; s < this.length; s++) {
								var h = this.words[s],
									u = (16777215 & ((h << n) | o)).toString(16);
								(i =
									0 !== (o = (h >>> (24 - n)) & 16777215) || s !== this.length - 1
										? a[6 - u.length] + u + i
										: u + i),
									(n += 2) >= 26 && ((n -= 26), s--);
							}
							for (0 !== o && (i = o.toString(16) + i); i.length % r != 0; ) i = '0' + i;
							return 0 !== this.negative && (i = '-' + i), i;
						}
						if (t === (0 | t) && t >= 2 && t <= 36) {
							var m = l[t],
								c = f[t];
							i = '';
							var d = this.clone();
							for (d.negative = 0; !d.isZero(); ) {
								var p = d.modn(c).toString(t);
								i = (d = d.idivn(c)).isZero() ? p + i : a[m - p.length] + p + i;
							}
							for (this.isZero() && (i = '0' + i); i.length % r != 0; ) i = '0' + i;
							return 0 !== this.negative && (i = '-' + i), i;
						}
						e(!1, 'Base should be between 2 and 36');
					}),
						(o.prototype.toNumber = function () {
							var t = this.words[0];
							return (
								2 === this.length
									? (t += 67108864 * this.words[1])
									: 3 === this.length && 1 === this.words[2]
									? (t += 4503599627370496 + 67108864 * this.words[1])
									: this.length > 2 && e(!1, 'Number can only safely store up to 53 bits'),
								0 !== this.negative ? -t : t
							);
						}),
						(o.prototype.toJSON = function () {
							return this.toString(16);
						}),
						(o.prototype.toBuffer = function (t, r) {
							return e(void 0 !== s), this.toArrayLike(s, t, r);
						}),
						(o.prototype.toArray = function (t, r) {
							return this.toArrayLike(Array, t, r);
						}),
						(o.prototype.toArrayLike = function (t, r, i) {
							var n = this.byteLength(),
								o = i || Math.max(1, n);
							e(n <= o, 'byte array longer than desired length'),
								e(o > 0, 'Requested array length <= 0'),
								this.strip();
							var s,
								h,
								u = 'le' === r,
								a = new t(o),
								l = this.clone();
							if (u) {
								for (h = 0; !l.isZero(); h++) (s = l.andln(255)), l.iushrn(8), (a[h] = s);
								for (; h < o; h++) a[h] = 0;
							} else {
								for (h = 0; h < o - n; h++) a[h] = 0;
								for (h = 0; !l.isZero(); h++) (s = l.andln(255)), l.iushrn(8), (a[o - h - 1] = s);
							}
							return a;
						}),
						Math.clz32
							? (o.prototype._countBits = function (t) {
									return 32 - Math.clz32(t);
							  })
							: (o.prototype._countBits = function (t) {
									var r = t,
										i = 0;
									return (
										r >= 4096 && ((i += 13), (r >>>= 13)),
										r >= 64 && ((i += 7), (r >>>= 7)),
										r >= 8 && ((i += 4), (r >>>= 4)),
										r >= 2 && ((i += 2), (r >>>= 2)),
										i + r
									);
							  }),
						(o.prototype._zeroBits = function (t) {
							if (0 === t) return 26;
							var r = t,
								i = 0;
							return (
								0 == (8191 & r) && ((i += 13), (r >>>= 13)),
								0 == (127 & r) && ((i += 7), (r >>>= 7)),
								0 == (15 & r) && ((i += 4), (r >>>= 4)),
								0 == (3 & r) && ((i += 2), (r >>>= 2)),
								0 == (1 & r) && i++,
								i
							);
						}),
						(o.prototype.bitLength = function () {
							var t = this.words[this.length - 1],
								r = this._countBits(t);
							return 26 * (this.length - 1) + r;
						}),
						(o.prototype.zeroBits = function () {
							if (this.isZero()) return 0;
							for (var t = 0, r = 0; r < this.length; r++) {
								var i = this._zeroBits(this.words[r]);
								if (((t += i), 26 !== i)) break;
							}
							return t;
						}),
						(o.prototype.byteLength = function () {
							return Math.ceil(this.bitLength() / 8);
						}),
						(o.prototype.toTwos = function (t) {
							return 0 !== this.negative ? this.abs().inotn(t).iaddn(1) : this.clone();
						}),
						(o.prototype.fromTwos = function (t) {
							return this.testn(t - 1) ? this.notn(t).iaddn(1).ineg() : this.clone();
						}),
						(o.prototype.isNeg = function () {
							return 0 !== this.negative;
						}),
						(o.prototype.neg = function () {
							return this.clone().ineg();
						}),
						(o.prototype.ineg = function () {
							return this.isZero() || (this.negative ^= 1), this;
						}),
						(o.prototype.iuor = function (t) {
							for (; this.length < t.length; ) this.words[this.length++] = 0;
							for (var r = 0; r < t.length; r++) this.words[r] = this.words[r] | t.words[r];
							return this.strip();
						}),
						(o.prototype.ior = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuor(t);
						}),
						(o.prototype.or = function (t) {
							return this.length > t.length ? this.clone().ior(t) : t.clone().ior(this);
						}),
						(o.prototype.uor = function (t) {
							return this.length > t.length ? this.clone().iuor(t) : t.clone().iuor(this);
						}),
						(o.prototype.iuand = function (t) {
							var r;
							r = this.length > t.length ? t : this;
							for (var i = 0; i < r.length; i++) this.words[i] = this.words[i] & t.words[i];
							return (this.length = r.length), this.strip();
						}),
						(o.prototype.iand = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuand(t);
						}),
						(o.prototype.and = function (t) {
							return this.length > t.length ? this.clone().iand(t) : t.clone().iand(this);
						}),
						(o.prototype.uand = function (t) {
							return this.length > t.length ? this.clone().iuand(t) : t.clone().iuand(this);
						}),
						(o.prototype.iuxor = function (t) {
							var r, i;
							this.length > t.length ? ((r = this), (i = t)) : ((r = t), (i = this));
							for (var e = 0; e < i.length; e++) this.words[e] = r.words[e] ^ i.words[e];
							if (this !== r) for (; e < r.length; e++) this.words[e] = r.words[e];
							return (this.length = r.length), this.strip();
						}),
						(o.prototype.ixor = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuxor(t);
						}),
						(o.prototype.xor = function (t) {
							return this.length > t.length ? this.clone().ixor(t) : t.clone().ixor(this);
						}),
						(o.prototype.uxor = function (t) {
							return this.length > t.length ? this.clone().iuxor(t) : t.clone().iuxor(this);
						}),
						(o.prototype.inotn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = 0 | Math.ceil(t / 26),
								i = t % 26;
							this._expand(r), i > 0 && r--;
							for (var n = 0; n < r; n++) this.words[n] = 67108863 & ~this.words[n];
							return (
								i > 0 && (this.words[n] = ~this.words[n] & (67108863 >> (26 - i))), this.strip()
							);
						}),
						(o.prototype.notn = function (t) {
							return this.clone().inotn(t);
						}),
						(o.prototype.setn = function (t, r) {
							e('number' == typeof t && t >= 0);
							var i = (t / 26) | 0,
								n = t % 26;
							return (
								this._expand(i + 1),
								(this.words[i] = r ? this.words[i] | (1 << n) : this.words[i] & ~(1 << n)),
								this.strip()
							);
						}),
						(o.prototype.iadd = function (t) {
							var r, i, e;
							if (0 !== this.negative && 0 === t.negative)
								return (
									(this.negative = 0), (r = this.isub(t)), (this.negative ^= 1), this._normSign()
								);
							if (0 === this.negative && 0 !== t.negative)
								return (t.negative = 0), (r = this.isub(t)), (t.negative = 1), r._normSign();
							this.length > t.length ? ((i = this), (e = t)) : ((i = t), (e = this));
							for (var n = 0, o = 0; o < e.length; o++)
								(r = (0 | i.words[o]) + (0 | e.words[o]) + n),
									(this.words[o] = 67108863 & r),
									(n = r >>> 26);
							for (; 0 !== n && o < i.length; o++)
								(r = (0 | i.words[o]) + n), (this.words[o] = 67108863 & r), (n = r >>> 26);
							if (((this.length = i.length), 0 !== n)) (this.words[this.length] = n), this.length++;
							else if (i !== this) for (; o < i.length; o++) this.words[o] = i.words[o];
							return this;
						}),
						(o.prototype.add = function (t) {
							var r;
							return 0 !== t.negative && 0 === this.negative
								? ((t.negative = 0), (r = this.sub(t)), (t.negative ^= 1), r)
								: 0 === t.negative && 0 !== this.negative
								? ((this.negative = 0), (r = t.sub(this)), (this.negative = 1), r)
								: this.length > t.length
								? this.clone().iadd(t)
								: t.clone().iadd(this);
						}),
						(o.prototype.isub = function (t) {
							if (0 !== t.negative) {
								t.negative = 0;
								var r = this.iadd(t);
								return (t.negative = 1), r._normSign();
							}
							if (0 !== this.negative)
								return (this.negative = 0), this.iadd(t), (this.negative = 1), this._normSign();
							var i,
								e,
								n = this.cmp(t);
							if (0 === n) return (this.negative = 0), (this.length = 1), (this.words[0] = 0), this;
							n > 0 ? ((i = this), (e = t)) : ((i = t), (e = this));
							for (var o = 0, s = 0; s < e.length; s++)
								(o = (r = (0 | i.words[s]) - (0 | e.words[s]) + o) >> 26),
									(this.words[s] = 67108863 & r);
							for (; 0 !== o && s < i.length; s++)
								(o = (r = (0 | i.words[s]) + o) >> 26), (this.words[s] = 67108863 & r);
							if (0 === o && s < i.length && i !== this)
								for (; s < i.length; s++) this.words[s] = i.words[s];
							return (
								(this.length = Math.max(this.length, s)),
								i !== this && (this.negative = 1),
								this.strip()
							);
						}),
						(o.prototype.sub = function (t) {
							return this.clone().isub(t);
						});
					var c = function (t, r, i) {
						var e,
							n,
							o,
							s = t.words,
							h = r.words,
							u = i.words,
							a = 0,
							l = 0 | s[0],
							f = 8191 & l,
							m = l >>> 13,
							c = 0 | s[1],
							d = 8191 & c,
							p = c >>> 13,
							g = 0 | s[2],
							v = 8191 & g,
							y = g >>> 13,
							w = 0 | s[3],
							M = 8191 & w,
							b = w >>> 13,
							_ = 0 | s[4],
							A = 8191 & _,
							E = _ >>> 13,
							x = 0 | s[5],
							S = 8191 & x,
							N = x >>> 13,
							T = 0 | s[6],
							R = 8191 & T,
							k = T >>> 13,
							I = 0 | s[7],
							B = 8191 & I,
							O = I >>> 13,
							C = 0 | s[8],
							L = 8191 & C,
							j = C >>> 13,
							P = 0 | s[9],
							U = 8191 & P,
							F = P >>> 13,
							D = 0 | h[0],
							Z = 8191 & D,
							z = D >>> 13,
							q = 0 | h[1],
							H = 8191 & q,
							W = q >>> 13,
							G = 0 | h[2],
							Y = 8191 & G,
							$ = G >>> 13,
							V = 0 | h[3],
							J = 8191 & V,
							K = V >>> 13,
							X = 0 | h[4],
							Q = 8191 & X,
							tt = X >>> 13,
							rt = 0 | h[5],
							it = 8191 & rt,
							et = rt >>> 13,
							nt = 0 | h[6],
							ot = 8191 & nt,
							st = nt >>> 13,
							ht = 0 | h[7],
							ut = 8191 & ht,
							at = ht >>> 13,
							lt = 0 | h[8],
							ft = 8191 & lt,
							mt = lt >>> 13,
							ct = 0 | h[9],
							dt = 8191 & ct,
							pt = ct >>> 13;
						(i.negative = t.negative ^ r.negative), (i.length = 19);
						var gt =
							(((a + (e = Math.imul(f, Z))) | 0) +
								((8191 & (n = ((n = Math.imul(f, z)) + Math.imul(m, Z)) | 0)) << 13)) |
							0;
						(a = ((((o = Math.imul(m, z)) + (n >>> 13)) | 0) + (gt >>> 26)) | 0),
							(gt &= 67108863),
							(e = Math.imul(d, Z)),
							(n = ((n = Math.imul(d, z)) + Math.imul(p, Z)) | 0),
							(o = Math.imul(p, z));
						var vt =
							(((a + (e = (e + Math.imul(f, H)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, W)) | 0) + Math.imul(m, H)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, W)) | 0) + (n >>> 13)) | 0) + (vt >>> 26)) | 0),
							(vt &= 67108863),
							(e = Math.imul(v, Z)),
							(n = ((n = Math.imul(v, z)) + Math.imul(y, Z)) | 0),
							(o = Math.imul(y, z)),
							(e = (e + Math.imul(d, H)) | 0),
							(n = ((n = (n + Math.imul(d, W)) | 0) + Math.imul(p, H)) | 0),
							(o = (o + Math.imul(p, W)) | 0);
						var yt =
							(((a + (e = (e + Math.imul(f, Y)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, $)) | 0) + Math.imul(m, Y)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, $)) | 0) + (n >>> 13)) | 0) + (yt >>> 26)) | 0),
							(yt &= 67108863),
							(e = Math.imul(M, Z)),
							(n = ((n = Math.imul(M, z)) + Math.imul(b, Z)) | 0),
							(o = Math.imul(b, z)),
							(e = (e + Math.imul(v, H)) | 0),
							(n = ((n = (n + Math.imul(v, W)) | 0) + Math.imul(y, H)) | 0),
							(o = (o + Math.imul(y, W)) | 0),
							(e = (e + Math.imul(d, Y)) | 0),
							(n = ((n = (n + Math.imul(d, $)) | 0) + Math.imul(p, Y)) | 0),
							(o = (o + Math.imul(p, $)) | 0);
						var wt =
							(((a + (e = (e + Math.imul(f, J)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, K)) | 0) + Math.imul(m, J)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, K)) | 0) + (n >>> 13)) | 0) + (wt >>> 26)) | 0),
							(wt &= 67108863),
							(e = Math.imul(A, Z)),
							(n = ((n = Math.imul(A, z)) + Math.imul(E, Z)) | 0),
							(o = Math.imul(E, z)),
							(e = (e + Math.imul(M, H)) | 0),
							(n = ((n = (n + Math.imul(M, W)) | 0) + Math.imul(b, H)) | 0),
							(o = (o + Math.imul(b, W)) | 0),
							(e = (e + Math.imul(v, Y)) | 0),
							(n = ((n = (n + Math.imul(v, $)) | 0) + Math.imul(y, Y)) | 0),
							(o = (o + Math.imul(y, $)) | 0),
							(e = (e + Math.imul(d, J)) | 0),
							(n = ((n = (n + Math.imul(d, K)) | 0) + Math.imul(p, J)) | 0),
							(o = (o + Math.imul(p, K)) | 0);
						var Mt =
							(((a + (e = (e + Math.imul(f, Q)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, tt)) | 0) + Math.imul(m, Q)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, tt)) | 0) + (n >>> 13)) | 0) + (Mt >>> 26)) | 0),
							(Mt &= 67108863),
							(e = Math.imul(S, Z)),
							(n = ((n = Math.imul(S, z)) + Math.imul(N, Z)) | 0),
							(o = Math.imul(N, z)),
							(e = (e + Math.imul(A, H)) | 0),
							(n = ((n = (n + Math.imul(A, W)) | 0) + Math.imul(E, H)) | 0),
							(o = (o + Math.imul(E, W)) | 0),
							(e = (e + Math.imul(M, Y)) | 0),
							(n = ((n = (n + Math.imul(M, $)) | 0) + Math.imul(b, Y)) | 0),
							(o = (o + Math.imul(b, $)) | 0),
							(e = (e + Math.imul(v, J)) | 0),
							(n = ((n = (n + Math.imul(v, K)) | 0) + Math.imul(y, J)) | 0),
							(o = (o + Math.imul(y, K)) | 0),
							(e = (e + Math.imul(d, Q)) | 0),
							(n = ((n = (n + Math.imul(d, tt)) | 0) + Math.imul(p, Q)) | 0),
							(o = (o + Math.imul(p, tt)) | 0);
						var bt =
							(((a + (e = (e + Math.imul(f, it)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, et)) | 0) + Math.imul(m, it)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, et)) | 0) + (n >>> 13)) | 0) + (bt >>> 26)) | 0),
							(bt &= 67108863),
							(e = Math.imul(R, Z)),
							(n = ((n = Math.imul(R, z)) + Math.imul(k, Z)) | 0),
							(o = Math.imul(k, z)),
							(e = (e + Math.imul(S, H)) | 0),
							(n = ((n = (n + Math.imul(S, W)) | 0) + Math.imul(N, H)) | 0),
							(o = (o + Math.imul(N, W)) | 0),
							(e = (e + Math.imul(A, Y)) | 0),
							(n = ((n = (n + Math.imul(A, $)) | 0) + Math.imul(E, Y)) | 0),
							(o = (o + Math.imul(E, $)) | 0),
							(e = (e + Math.imul(M, J)) | 0),
							(n = ((n = (n + Math.imul(M, K)) | 0) + Math.imul(b, J)) | 0),
							(o = (o + Math.imul(b, K)) | 0),
							(e = (e + Math.imul(v, Q)) | 0),
							(n = ((n = (n + Math.imul(v, tt)) | 0) + Math.imul(y, Q)) | 0),
							(o = (o + Math.imul(y, tt)) | 0),
							(e = (e + Math.imul(d, it)) | 0),
							(n = ((n = (n + Math.imul(d, et)) | 0) + Math.imul(p, it)) | 0),
							(o = (o + Math.imul(p, et)) | 0);
						var _t =
							(((a + (e = (e + Math.imul(f, ot)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, st)) | 0) + Math.imul(m, ot)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, st)) | 0) + (n >>> 13)) | 0) + (_t >>> 26)) | 0),
							(_t &= 67108863),
							(e = Math.imul(B, Z)),
							(n = ((n = Math.imul(B, z)) + Math.imul(O, Z)) | 0),
							(o = Math.imul(O, z)),
							(e = (e + Math.imul(R, H)) | 0),
							(n = ((n = (n + Math.imul(R, W)) | 0) + Math.imul(k, H)) | 0),
							(o = (o + Math.imul(k, W)) | 0),
							(e = (e + Math.imul(S, Y)) | 0),
							(n = ((n = (n + Math.imul(S, $)) | 0) + Math.imul(N, Y)) | 0),
							(o = (o + Math.imul(N, $)) | 0),
							(e = (e + Math.imul(A, J)) | 0),
							(n = ((n = (n + Math.imul(A, K)) | 0) + Math.imul(E, J)) | 0),
							(o = (o + Math.imul(E, K)) | 0),
							(e = (e + Math.imul(M, Q)) | 0),
							(n = ((n = (n + Math.imul(M, tt)) | 0) + Math.imul(b, Q)) | 0),
							(o = (o + Math.imul(b, tt)) | 0),
							(e = (e + Math.imul(v, it)) | 0),
							(n = ((n = (n + Math.imul(v, et)) | 0) + Math.imul(y, it)) | 0),
							(o = (o + Math.imul(y, et)) | 0),
							(e = (e + Math.imul(d, ot)) | 0),
							(n = ((n = (n + Math.imul(d, st)) | 0) + Math.imul(p, ot)) | 0),
							(o = (o + Math.imul(p, st)) | 0);
						var At =
							(((a + (e = (e + Math.imul(f, ut)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, at)) | 0) + Math.imul(m, ut)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, at)) | 0) + (n >>> 13)) | 0) + (At >>> 26)) | 0),
							(At &= 67108863),
							(e = Math.imul(L, Z)),
							(n = ((n = Math.imul(L, z)) + Math.imul(j, Z)) | 0),
							(o = Math.imul(j, z)),
							(e = (e + Math.imul(B, H)) | 0),
							(n = ((n = (n + Math.imul(B, W)) | 0) + Math.imul(O, H)) | 0),
							(o = (o + Math.imul(O, W)) | 0),
							(e = (e + Math.imul(R, Y)) | 0),
							(n = ((n = (n + Math.imul(R, $)) | 0) + Math.imul(k, Y)) | 0),
							(o = (o + Math.imul(k, $)) | 0),
							(e = (e + Math.imul(S, J)) | 0),
							(n = ((n = (n + Math.imul(S, K)) | 0) + Math.imul(N, J)) | 0),
							(o = (o + Math.imul(N, K)) | 0),
							(e = (e + Math.imul(A, Q)) | 0),
							(n = ((n = (n + Math.imul(A, tt)) | 0) + Math.imul(E, Q)) | 0),
							(o = (o + Math.imul(E, tt)) | 0),
							(e = (e + Math.imul(M, it)) | 0),
							(n = ((n = (n + Math.imul(M, et)) | 0) + Math.imul(b, it)) | 0),
							(o = (o + Math.imul(b, et)) | 0),
							(e = (e + Math.imul(v, ot)) | 0),
							(n = ((n = (n + Math.imul(v, st)) | 0) + Math.imul(y, ot)) | 0),
							(o = (o + Math.imul(y, st)) | 0),
							(e = (e + Math.imul(d, ut)) | 0),
							(n = ((n = (n + Math.imul(d, at)) | 0) + Math.imul(p, ut)) | 0),
							(o = (o + Math.imul(p, at)) | 0);
						var Et =
							(((a + (e = (e + Math.imul(f, ft)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, mt)) | 0) + Math.imul(m, ft)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, mt)) | 0) + (n >>> 13)) | 0) + (Et >>> 26)) | 0),
							(Et &= 67108863),
							(e = Math.imul(U, Z)),
							(n = ((n = Math.imul(U, z)) + Math.imul(F, Z)) | 0),
							(o = Math.imul(F, z)),
							(e = (e + Math.imul(L, H)) | 0),
							(n = ((n = (n + Math.imul(L, W)) | 0) + Math.imul(j, H)) | 0),
							(o = (o + Math.imul(j, W)) | 0),
							(e = (e + Math.imul(B, Y)) | 0),
							(n = ((n = (n + Math.imul(B, $)) | 0) + Math.imul(O, Y)) | 0),
							(o = (o + Math.imul(O, $)) | 0),
							(e = (e + Math.imul(R, J)) | 0),
							(n = ((n = (n + Math.imul(R, K)) | 0) + Math.imul(k, J)) | 0),
							(o = (o + Math.imul(k, K)) | 0),
							(e = (e + Math.imul(S, Q)) | 0),
							(n = ((n = (n + Math.imul(S, tt)) | 0) + Math.imul(N, Q)) | 0),
							(o = (o + Math.imul(N, tt)) | 0),
							(e = (e + Math.imul(A, it)) | 0),
							(n = ((n = (n + Math.imul(A, et)) | 0) + Math.imul(E, it)) | 0),
							(o = (o + Math.imul(E, et)) | 0),
							(e = (e + Math.imul(M, ot)) | 0),
							(n = ((n = (n + Math.imul(M, st)) | 0) + Math.imul(b, ot)) | 0),
							(o = (o + Math.imul(b, st)) | 0),
							(e = (e + Math.imul(v, ut)) | 0),
							(n = ((n = (n + Math.imul(v, at)) | 0) + Math.imul(y, ut)) | 0),
							(o = (o + Math.imul(y, at)) | 0),
							(e = (e + Math.imul(d, ft)) | 0),
							(n = ((n = (n + Math.imul(d, mt)) | 0) + Math.imul(p, ft)) | 0),
							(o = (o + Math.imul(p, mt)) | 0);
						var xt =
							(((a + (e = (e + Math.imul(f, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, pt)) | 0) + Math.imul(m, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, pt)) | 0) + (n >>> 13)) | 0) + (xt >>> 26)) | 0),
							(xt &= 67108863),
							(e = Math.imul(U, H)),
							(n = ((n = Math.imul(U, W)) + Math.imul(F, H)) | 0),
							(o = Math.imul(F, W)),
							(e = (e + Math.imul(L, Y)) | 0),
							(n = ((n = (n + Math.imul(L, $)) | 0) + Math.imul(j, Y)) | 0),
							(o = (o + Math.imul(j, $)) | 0),
							(e = (e + Math.imul(B, J)) | 0),
							(n = ((n = (n + Math.imul(B, K)) | 0) + Math.imul(O, J)) | 0),
							(o = (o + Math.imul(O, K)) | 0),
							(e = (e + Math.imul(R, Q)) | 0),
							(n = ((n = (n + Math.imul(R, tt)) | 0) + Math.imul(k, Q)) | 0),
							(o = (o + Math.imul(k, tt)) | 0),
							(e = (e + Math.imul(S, it)) | 0),
							(n = ((n = (n + Math.imul(S, et)) | 0) + Math.imul(N, it)) | 0),
							(o = (o + Math.imul(N, et)) | 0),
							(e = (e + Math.imul(A, ot)) | 0),
							(n = ((n = (n + Math.imul(A, st)) | 0) + Math.imul(E, ot)) | 0),
							(o = (o + Math.imul(E, st)) | 0),
							(e = (e + Math.imul(M, ut)) | 0),
							(n = ((n = (n + Math.imul(M, at)) | 0) + Math.imul(b, ut)) | 0),
							(o = (o + Math.imul(b, at)) | 0),
							(e = (e + Math.imul(v, ft)) | 0),
							(n = ((n = (n + Math.imul(v, mt)) | 0) + Math.imul(y, ft)) | 0),
							(o = (o + Math.imul(y, mt)) | 0);
						var St =
							(((a + (e = (e + Math.imul(d, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(d, pt)) | 0) + Math.imul(p, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(p, pt)) | 0) + (n >>> 13)) | 0) + (St >>> 26)) | 0),
							(St &= 67108863),
							(e = Math.imul(U, Y)),
							(n = ((n = Math.imul(U, $)) + Math.imul(F, Y)) | 0),
							(o = Math.imul(F, $)),
							(e = (e + Math.imul(L, J)) | 0),
							(n = ((n = (n + Math.imul(L, K)) | 0) + Math.imul(j, J)) | 0),
							(o = (o + Math.imul(j, K)) | 0),
							(e = (e + Math.imul(B, Q)) | 0),
							(n = ((n = (n + Math.imul(B, tt)) | 0) + Math.imul(O, Q)) | 0),
							(o = (o + Math.imul(O, tt)) | 0),
							(e = (e + Math.imul(R, it)) | 0),
							(n = ((n = (n + Math.imul(R, et)) | 0) + Math.imul(k, it)) | 0),
							(o = (o + Math.imul(k, et)) | 0),
							(e = (e + Math.imul(S, ot)) | 0),
							(n = ((n = (n + Math.imul(S, st)) | 0) + Math.imul(N, ot)) | 0),
							(o = (o + Math.imul(N, st)) | 0),
							(e = (e + Math.imul(A, ut)) | 0),
							(n = ((n = (n + Math.imul(A, at)) | 0) + Math.imul(E, ut)) | 0),
							(o = (o + Math.imul(E, at)) | 0),
							(e = (e + Math.imul(M, ft)) | 0),
							(n = ((n = (n + Math.imul(M, mt)) | 0) + Math.imul(b, ft)) | 0),
							(o = (o + Math.imul(b, mt)) | 0);
						var Nt =
							(((a + (e = (e + Math.imul(v, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(v, pt)) | 0) + Math.imul(y, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(y, pt)) | 0) + (n >>> 13)) | 0) + (Nt >>> 26)) | 0),
							(Nt &= 67108863),
							(e = Math.imul(U, J)),
							(n = ((n = Math.imul(U, K)) + Math.imul(F, J)) | 0),
							(o = Math.imul(F, K)),
							(e = (e + Math.imul(L, Q)) | 0),
							(n = ((n = (n + Math.imul(L, tt)) | 0) + Math.imul(j, Q)) | 0),
							(o = (o + Math.imul(j, tt)) | 0),
							(e = (e + Math.imul(B, it)) | 0),
							(n = ((n = (n + Math.imul(B, et)) | 0) + Math.imul(O, it)) | 0),
							(o = (o + Math.imul(O, et)) | 0),
							(e = (e + Math.imul(R, ot)) | 0),
							(n = ((n = (n + Math.imul(R, st)) | 0) + Math.imul(k, ot)) | 0),
							(o = (o + Math.imul(k, st)) | 0),
							(e = (e + Math.imul(S, ut)) | 0),
							(n = ((n = (n + Math.imul(S, at)) | 0) + Math.imul(N, ut)) | 0),
							(o = (o + Math.imul(N, at)) | 0),
							(e = (e + Math.imul(A, ft)) | 0),
							(n = ((n = (n + Math.imul(A, mt)) | 0) + Math.imul(E, ft)) | 0),
							(o = (o + Math.imul(E, mt)) | 0);
						var Tt =
							(((a + (e = (e + Math.imul(M, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(M, pt)) | 0) + Math.imul(b, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(b, pt)) | 0) + (n >>> 13)) | 0) + (Tt >>> 26)) | 0),
							(Tt &= 67108863),
							(e = Math.imul(U, Q)),
							(n = ((n = Math.imul(U, tt)) + Math.imul(F, Q)) | 0),
							(o = Math.imul(F, tt)),
							(e = (e + Math.imul(L, it)) | 0),
							(n = ((n = (n + Math.imul(L, et)) | 0) + Math.imul(j, it)) | 0),
							(o = (o + Math.imul(j, et)) | 0),
							(e = (e + Math.imul(B, ot)) | 0),
							(n = ((n = (n + Math.imul(B, st)) | 0) + Math.imul(O, ot)) | 0),
							(o = (o + Math.imul(O, st)) | 0),
							(e = (e + Math.imul(R, ut)) | 0),
							(n = ((n = (n + Math.imul(R, at)) | 0) + Math.imul(k, ut)) | 0),
							(o = (o + Math.imul(k, at)) | 0),
							(e = (e + Math.imul(S, ft)) | 0),
							(n = ((n = (n + Math.imul(S, mt)) | 0) + Math.imul(N, ft)) | 0),
							(o = (o + Math.imul(N, mt)) | 0);
						var Rt =
							(((a + (e = (e + Math.imul(A, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(A, pt)) | 0) + Math.imul(E, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(E, pt)) | 0) + (n >>> 13)) | 0) + (Rt >>> 26)) | 0),
							(Rt &= 67108863),
							(e = Math.imul(U, it)),
							(n = ((n = Math.imul(U, et)) + Math.imul(F, it)) | 0),
							(o = Math.imul(F, et)),
							(e = (e + Math.imul(L, ot)) | 0),
							(n = ((n = (n + Math.imul(L, st)) | 0) + Math.imul(j, ot)) | 0),
							(o = (o + Math.imul(j, st)) | 0),
							(e = (e + Math.imul(B, ut)) | 0),
							(n = ((n = (n + Math.imul(B, at)) | 0) + Math.imul(O, ut)) | 0),
							(o = (o + Math.imul(O, at)) | 0),
							(e = (e + Math.imul(R, ft)) | 0),
							(n = ((n = (n + Math.imul(R, mt)) | 0) + Math.imul(k, ft)) | 0),
							(o = (o + Math.imul(k, mt)) | 0);
						var kt =
							(((a + (e = (e + Math.imul(S, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(S, pt)) | 0) + Math.imul(N, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(N, pt)) | 0) + (n >>> 13)) | 0) + (kt >>> 26)) | 0),
							(kt &= 67108863),
							(e = Math.imul(U, ot)),
							(n = ((n = Math.imul(U, st)) + Math.imul(F, ot)) | 0),
							(o = Math.imul(F, st)),
							(e = (e + Math.imul(L, ut)) | 0),
							(n = ((n = (n + Math.imul(L, at)) | 0) + Math.imul(j, ut)) | 0),
							(o = (o + Math.imul(j, at)) | 0),
							(e = (e + Math.imul(B, ft)) | 0),
							(n = ((n = (n + Math.imul(B, mt)) | 0) + Math.imul(O, ft)) | 0),
							(o = (o + Math.imul(O, mt)) | 0);
						var It =
							(((a + (e = (e + Math.imul(R, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(R, pt)) | 0) + Math.imul(k, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(k, pt)) | 0) + (n >>> 13)) | 0) + (It >>> 26)) | 0),
							(It &= 67108863),
							(e = Math.imul(U, ut)),
							(n = ((n = Math.imul(U, at)) + Math.imul(F, ut)) | 0),
							(o = Math.imul(F, at)),
							(e = (e + Math.imul(L, ft)) | 0),
							(n = ((n = (n + Math.imul(L, mt)) | 0) + Math.imul(j, ft)) | 0),
							(o = (o + Math.imul(j, mt)) | 0);
						var Bt =
							(((a + (e = (e + Math.imul(B, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(B, pt)) | 0) + Math.imul(O, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(O, pt)) | 0) + (n >>> 13)) | 0) + (Bt >>> 26)) | 0),
							(Bt &= 67108863),
							(e = Math.imul(U, ft)),
							(n = ((n = Math.imul(U, mt)) + Math.imul(F, ft)) | 0),
							(o = Math.imul(F, mt));
						var Ot =
							(((a + (e = (e + Math.imul(L, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(L, pt)) | 0) + Math.imul(j, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(j, pt)) | 0) + (n >>> 13)) | 0) + (Ot >>> 26)) | 0),
							(Ot &= 67108863);
						var Ct =
							(((a + (e = Math.imul(U, dt))) | 0) +
								((8191 & (n = ((n = Math.imul(U, pt)) + Math.imul(F, dt)) | 0)) << 13)) |
							0;
						return (
							(a = ((((o = Math.imul(F, pt)) + (n >>> 13)) | 0) + (Ct >>> 26)) | 0),
							(Ct &= 67108863),
							(u[0] = gt),
							(u[1] = vt),
							(u[2] = yt),
							(u[3] = wt),
							(u[4] = Mt),
							(u[5] = bt),
							(u[6] = _t),
							(u[7] = At),
							(u[8] = Et),
							(u[9] = xt),
							(u[10] = St),
							(u[11] = Nt),
							(u[12] = Tt),
							(u[13] = Rt),
							(u[14] = kt),
							(u[15] = It),
							(u[16] = Bt),
							(u[17] = Ot),
							(u[18] = Ct),
							0 !== a && ((u[19] = a), i.length++),
							i
						);
					};
					function d(t, r, i) {
						return new p().mulp(t, r, i);
					}
					function p(t, r) {
						(this.x = t), (this.y = r);
					}
					Math.imul || (c = m),
						(o.prototype.mulTo = function (t, r) {
							var i = this.length + t.length;
							return 10 === this.length && 10 === t.length
								? c(this, t, r)
								: i < 63
								? m(this, t, r)
								: i < 1024
								? (function (t, r, i) {
										(i.negative = r.negative ^ t.negative), (i.length = t.length + r.length);
										for (var e = 0, n = 0, o = 0; o < i.length - 1; o++) {
											var s = n;
											n = 0;
											for (
												var h = 67108863 & e,
													u = Math.min(o, r.length - 1),
													a = Math.max(0, o - t.length + 1);
												a <= u;
												a++
											) {
												var l = o - a,
													f = (0 | t.words[l]) * (0 | r.words[a]),
													m = 67108863 & f;
												(h = 67108863 & (m = (m + h) | 0)),
													(n +=
														(s = ((s = (s + ((f / 67108864) | 0)) | 0) + (m >>> 26)) | 0) >>> 26),
													(s &= 67108863);
											}
											(i.words[o] = h), (e = s), (s = n);
										}
										return 0 !== e ? (i.words[o] = e) : i.length--, i.strip();
								  })(this, t, r)
								: d(this, t, r);
						}),
						(p.prototype.makeRBT = function (t) {
							for (var r = new Array(t), i = o.prototype._countBits(t) - 1, e = 0; e < t; e++)
								r[e] = this.revBin(e, i, t);
							return r;
						}),
						(p.prototype.revBin = function (t, r, i) {
							if (0 === t || t === i - 1) return t;
							for (var e = 0, n = 0; n < r; n++) (e |= (1 & t) << (r - n - 1)), (t >>= 1);
							return e;
						}),
						(p.prototype.permute = function (t, r, i, e, n, o) {
							for (var s = 0; s < o; s++) (e[s] = r[t[s]]), (n[s] = i[t[s]]);
						}),
						(p.prototype.transform = function (t, r, i, e, n, o) {
							this.permute(o, t, r, i, e, n);
							for (var s = 1; s < n; s <<= 1)
								for (
									var h = s << 1,
										u = Math.cos((2 * Math.PI) / h),
										a = Math.sin((2 * Math.PI) / h),
										l = 0;
									l < n;
									l += h
								)
									for (var f = u, m = a, c = 0; c < s; c++) {
										var d = i[l + c],
											p = e[l + c],
											g = i[l + c + s],
											v = e[l + c + s],
											y = f * g - m * v;
										(v = f * v + m * g),
											(g = y),
											(i[l + c] = d + g),
											(e[l + c] = p + v),
											(i[l + c + s] = d - g),
											(e[l + c + s] = p - v),
											c !== h && ((y = u * f - a * m), (m = u * m + a * f), (f = y));
									}
						}),
						(p.prototype.guessLen13b = function (t, r) {
							var i = 1 | Math.max(r, t),
								e = 1 & i,
								n = 0;
							for (i = (i / 2) | 0; i; i >>>= 1) n++;
							return 1 << (n + 1 + e);
						}),
						(p.prototype.conjugate = function (t, r, i) {
							if (!(i <= 1))
								for (var e = 0; e < i / 2; e++) {
									var n = t[e];
									(t[e] = t[i - e - 1]),
										(t[i - e - 1] = n),
										(n = r[e]),
										(r[e] = -r[i - e - 1]),
										(r[i - e - 1] = -n);
								}
						}),
						(p.prototype.normalize13b = function (t, r) {
							for (var i = 0, e = 0; e < r / 2; e++) {
								var n = 8192 * Math.round(t[2 * e + 1] / r) + Math.round(t[2 * e] / r) + i;
								(t[e] = 67108863 & n), (i = n < 67108864 ? 0 : (n / 67108864) | 0);
							}
							return t;
						}),
						(p.prototype.convert13b = function (t, r, i, n) {
							for (var o = 0, s = 0; s < r; s++)
								(o += 0 | t[s]),
									(i[2 * s] = 8191 & o),
									(o >>>= 13),
									(i[2 * s + 1] = 8191 & o),
									(o >>>= 13);
							for (s = 2 * r; s < n; ++s) i[s] = 0;
							e(0 === o), e(0 == (-8192 & o));
						}),
						(p.prototype.stub = function (t) {
							for (var r = new Array(t), i = 0; i < t; i++) r[i] = 0;
							return r;
						}),
						(p.prototype.mulp = function (t, r, i) {
							var e = 2 * this.guessLen13b(t.length, r.length),
								n = this.makeRBT(e),
								o = this.stub(e),
								s = new Array(e),
								h = new Array(e),
								u = new Array(e),
								a = new Array(e),
								l = new Array(e),
								f = new Array(e),
								m = i.words;
							(m.length = e),
								this.convert13b(t.words, t.length, s, e),
								this.convert13b(r.words, r.length, a, e),
								this.transform(s, o, h, u, e, n),
								this.transform(a, o, l, f, e, n);
							for (var c = 0; c < e; c++) {
								var d = h[c] * l[c] - u[c] * f[c];
								(u[c] = h[c] * f[c] + u[c] * l[c]), (h[c] = d);
							}
							return (
								this.conjugate(h, u, e),
								this.transform(h, u, m, o, e, n),
								this.conjugate(m, o, e),
								this.normalize13b(m, e),
								(i.negative = t.negative ^ r.negative),
								(i.length = t.length + r.length),
								i.strip()
							);
						}),
						(o.prototype.mul = function (t) {
							var r = new o(null);
							return (r.words = new Array(this.length + t.length)), this.mulTo(t, r);
						}),
						(o.prototype.mulf = function (t) {
							var r = new o(null);
							return (r.words = new Array(this.length + t.length)), d(this, t, r);
						}),
						(o.prototype.imul = function (t) {
							return this.clone().mulTo(t, this);
						}),
						(o.prototype.imuln = function (t) {
							e('number' == typeof t), e(t < 67108864);
							for (var r = 0, i = 0; i < this.length; i++) {
								var n = (0 | this.words[i]) * t,
									o = (67108863 & n) + (67108863 & r);
								(r >>= 26),
									(r += (n / 67108864) | 0),
									(r += o >>> 26),
									(this.words[i] = 67108863 & o);
							}
							return 0 !== r && ((this.words[i] = r), this.length++), this;
						}),
						(o.prototype.muln = function (t) {
							return this.clone().imuln(t);
						}),
						(o.prototype.sqr = function () {
							return this.mul(this);
						}),
						(o.prototype.isqr = function () {
							return this.imul(this.clone());
						}),
						(o.prototype.pow = function (t) {
							var r = (function (t) {
								for (var r = new Array(t.bitLength()), i = 0; i < r.length; i++) {
									var e = (i / 26) | 0,
										n = i % 26;
									r[i] = (t.words[e] & (1 << n)) >>> n;
								}
								return r;
							})(t);
							if (0 === r.length) return new o(1);
							for (var i = this, e = 0; e < r.length && 0 === r[e]; e++, i = i.sqr());
							if (++e < r.length)
								for (var n = i.sqr(); e < r.length; e++, n = n.sqr()) 0 !== r[e] && (i = i.mul(n));
							return i;
						}),
						(o.prototype.iushln = function (t) {
							e('number' == typeof t && t >= 0);
							var r,
								i = t % 26,
								n = (t - i) / 26,
								o = (67108863 >>> (26 - i)) << (26 - i);
							if (0 !== i) {
								var s = 0;
								for (r = 0; r < this.length; r++) {
									var h = this.words[r] & o,
										u = ((0 | this.words[r]) - h) << i;
									(this.words[r] = u | s), (s = h >>> (26 - i));
								}
								s && ((this.words[r] = s), this.length++);
							}
							if (0 !== n) {
								for (r = this.length - 1; r >= 0; r--) this.words[r + n] = this.words[r];
								for (r = 0; r < n; r++) this.words[r] = 0;
								this.length += n;
							}
							return this.strip();
						}),
						(o.prototype.ishln = function (t) {
							return e(0 === this.negative), this.iushln(t);
						}),
						(o.prototype.iushrn = function (t, r, i) {
							var n;
							e('number' == typeof t && t >= 0), (n = r ? (r - (r % 26)) / 26 : 0);
							var o = t % 26,
								s = Math.min((t - o) / 26, this.length),
								h = 67108863 ^ ((67108863 >>> o) << o),
								u = i;
							if (((n -= s), (n = Math.max(0, n)), u)) {
								for (var a = 0; a < s; a++) u.words[a] = this.words[a];
								u.length = s;
							}
							if (0 === s);
							else if (this.length > s)
								for (this.length -= s, a = 0; a < this.length; a++)
									this.words[a] = this.words[a + s];
							else (this.words[0] = 0), (this.length = 1);
							var l = 0;
							for (a = this.length - 1; a >= 0 && (0 !== l || a >= n); a--) {
								var f = 0 | this.words[a];
								(this.words[a] = (l << (26 - o)) | (f >>> o)), (l = f & h);
							}
							return (
								u && 0 !== l && (u.words[u.length++] = l),
								0 === this.length && ((this.words[0] = 0), (this.length = 1)),
								this.strip()
							);
						}),
						(o.prototype.ishrn = function (t, r, i) {
							return e(0 === this.negative), this.iushrn(t, r, i);
						}),
						(o.prototype.shln = function (t) {
							return this.clone().ishln(t);
						}),
						(o.prototype.ushln = function (t) {
							return this.clone().iushln(t);
						}),
						(o.prototype.shrn = function (t) {
							return this.clone().ishrn(t);
						}),
						(o.prototype.ushrn = function (t) {
							return this.clone().iushrn(t);
						}),
						(o.prototype.testn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = t % 26,
								i = (t - r) / 26,
								n = 1 << r;
							return !(this.length <= i) && !!(this.words[i] & n);
						}),
						(o.prototype.imaskn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = t % 26,
								i = (t - r) / 26;
							if (
								(e(0 === this.negative, 'imaskn works only with positive numbers'),
								this.length <= i)
							)
								return this;
							if ((0 !== r && i++, (this.length = Math.min(i, this.length)), 0 !== r)) {
								var n = 67108863 ^ ((67108863 >>> r) << r);
								this.words[this.length - 1] &= n;
							}
							return this.strip();
						}),
						(o.prototype.maskn = function (t) {
							return this.clone().imaskn(t);
						}),
						(o.prototype.iaddn = function (t) {
							return (
								e('number' == typeof t),
								e(t < 67108864),
								t < 0
									? this.isubn(-t)
									: 0 !== this.negative
									? 1 === this.length && (0 | this.words[0]) < t
										? ((this.words[0] = t - (0 | this.words[0])), (this.negative = 0), this)
										: ((this.negative = 0), this.isubn(t), (this.negative = 1), this)
									: this._iaddn(t)
							);
						}),
						(o.prototype._iaddn = function (t) {
							this.words[0] += t;
							for (var r = 0; r < this.length && this.words[r] >= 67108864; r++)
								(this.words[r] -= 67108864),
									r === this.length - 1 ? (this.words[r + 1] = 1) : this.words[r + 1]++;
							return (this.length = Math.max(this.length, r + 1)), this;
						}),
						(o.prototype.isubn = function (t) {
							if ((e('number' == typeof t), e(t < 67108864), t < 0)) return this.iaddn(-t);
							if (0 !== this.negative)
								return (this.negative = 0), this.iaddn(t), (this.negative = 1), this;
							if (((this.words[0] -= t), 1 === this.length && this.words[0] < 0))
								(this.words[0] = -this.words[0]), (this.negative = 1);
							else
								for (var r = 0; r < this.length && this.words[r] < 0; r++)
									(this.words[r] += 67108864), (this.words[r + 1] -= 1);
							return this.strip();
						}),
						(o.prototype.addn = function (t) {
							return this.clone().iaddn(t);
						}),
						(o.prototype.subn = function (t) {
							return this.clone().isubn(t);
						}),
						(o.prototype.iabs = function () {
							return (this.negative = 0), this;
						}),
						(o.prototype.abs = function () {
							return this.clone().iabs();
						}),
						(o.prototype._ishlnsubmul = function (t, r, i) {
							var n,
								o,
								s = t.length + i;
							this._expand(s);
							var h = 0;
							for (n = 0; n < t.length; n++) {
								o = (0 | this.words[n + i]) + h;
								var u = (0 | t.words[n]) * r;
								(h = ((o -= 67108863 & u) >> 26) - ((u / 67108864) | 0)),
									(this.words[n + i] = 67108863 & o);
							}
							for (; n < this.length - i; n++)
								(h = (o = (0 | this.words[n + i]) + h) >> 26), (this.words[n + i] = 67108863 & o);
							if (0 === h) return this.strip();
							for (e(-1 === h), h = 0, n = 0; n < this.length; n++)
								(h = (o = -(0 | this.words[n]) + h) >> 26), (this.words[n] = 67108863 & o);
							return (this.negative = 1), this.strip();
						}),
						(o.prototype._wordDiv = function (t, r) {
							var i = (this.length, t.length),
								e = this.clone(),
								n = t,
								s = 0 | n.words[n.length - 1];
							0 !== (i = 26 - this._countBits(s)) &&
								((n = n.ushln(i)), e.iushln(i), (s = 0 | n.words[n.length - 1]));
							var h,
								u = e.length - n.length;
							if ('mod' !== r) {
								((h = new o(null)).length = u + 1), (h.words = new Array(h.length));
								for (var a = 0; a < h.length; a++) h.words[a] = 0;
							}
							var l = e.clone()._ishlnsubmul(n, 1, u);
							0 === l.negative && ((e = l), h && (h.words[u] = 1));
							for (var f = u - 1; f >= 0; f--) {
								var m = 67108864 * (0 | e.words[n.length + f]) + (0 | e.words[n.length + f - 1]);
								for (
									m = Math.min((m / s) | 0, 67108863), e._ishlnsubmul(n, m, f);
									0 !== e.negative;

								)
									m--, (e.negative = 0), e._ishlnsubmul(n, 1, f), e.isZero() || (e.negative ^= 1);
								h && (h.words[f] = m);
							}
							return (
								h && h.strip(),
								e.strip(),
								'div' !== r && 0 !== i && e.iushrn(i),
								{ div: h || null, mod: e }
							);
						}),
						(o.prototype.divmod = function (t, r, i) {
							return (
								e(!t.isZero()),
								this.isZero()
									? { div: new o(0), mod: new o(0) }
									: 0 !== this.negative && 0 === t.negative
									? ((h = this.neg().divmod(t, r)),
									  'mod' !== r && (n = h.div.neg()),
									  'div' !== r && ((s = h.mod.neg()), i && 0 !== s.negative && s.iadd(t)),
									  { div: n, mod: s })
									: 0 === this.negative && 0 !== t.negative
									? ((h = this.divmod(t.neg(), r)),
									  'mod' !== r && (n = h.div.neg()),
									  { div: n, mod: h.mod })
									: 0 != (this.negative & t.negative)
									? ((h = this.neg().divmod(t.neg(), r)),
									  'div' !== r && ((s = h.mod.neg()), i && 0 !== s.negative && s.isub(t)),
									  { div: h.div, mod: s })
									: t.length > this.length || this.cmp(t) < 0
									? { div: new o(0), mod: this }
									: 1 === t.length
									? 'div' === r
										? { div: this.divn(t.words[0]), mod: null }
										: 'mod' === r
										? { div: null, mod: new o(this.modn(t.words[0])) }
										: { div: this.divn(t.words[0]), mod: new o(this.modn(t.words[0])) }
									: this._wordDiv(t, r)
							);
							var n, s, h;
						}),
						(o.prototype.div = function (t) {
							return this.divmod(t, 'div', !1).div;
						}),
						(o.prototype.mod = function (t) {
							return this.divmod(t, 'mod', !1).mod;
						}),
						(o.prototype.umod = function (t) {
							return this.divmod(t, 'mod', !0).mod;
						}),
						(o.prototype.divRound = function (t) {
							var r = this.divmod(t);
							if (r.mod.isZero()) return r.div;
							var i = 0 !== r.div.negative ? r.mod.isub(t) : r.mod,
								e = t.ushrn(1),
								n = t.andln(1),
								o = i.cmp(e);
							return o < 0 || (1 === n && 0 === o)
								? r.div
								: 0 !== r.div.negative
								? r.div.isubn(1)
								: r.div.iaddn(1);
						}),
						(o.prototype.modn = function (t) {
							e(t <= 67108863);
							for (var r = (1 << 26) % t, i = 0, n = this.length - 1; n >= 0; n--)
								i = (r * i + (0 | this.words[n])) % t;
							return i;
						}),
						(o.prototype.idivn = function (t) {
							e(t <= 67108863);
							for (var r = 0, i = this.length - 1; i >= 0; i--) {
								var n = (0 | this.words[i]) + 67108864 * r;
								(this.words[i] = (n / t) | 0), (r = n % t);
							}
							return this.strip();
						}),
						(o.prototype.divn = function (t) {
							return this.clone().idivn(t);
						}),
						(o.prototype.egcd = function (t) {
							e(0 === t.negative), e(!t.isZero());
							var r = this,
								i = t.clone();
							r = 0 !== r.negative ? r.umod(t) : r.clone();
							for (
								var n = new o(1), s = new o(0), h = new o(0), u = new o(1), a = 0;
								r.isEven() && i.isEven();

							)
								r.iushrn(1), i.iushrn(1), ++a;
							for (var l = i.clone(), f = r.clone(); !r.isZero(); ) {
								for (var m = 0, c = 1; 0 == (r.words[0] & c) && m < 26; ++m, c <<= 1);
								if (m > 0)
									for (r.iushrn(m); m-- > 0; )
										(n.isOdd() || s.isOdd()) && (n.iadd(l), s.isub(f)), n.iushrn(1), s.iushrn(1);
								for (var d = 0, p = 1; 0 == (i.words[0] & p) && d < 26; ++d, p <<= 1);
								if (d > 0)
									for (i.iushrn(d); d-- > 0; )
										(h.isOdd() || u.isOdd()) && (h.iadd(l), u.isub(f)), h.iushrn(1), u.iushrn(1);
								r.cmp(i) >= 0
									? (r.isub(i), n.isub(h), s.isub(u))
									: (i.isub(r), h.isub(n), u.isub(s));
							}
							return { a: h, b: u, gcd: i.iushln(a) };
						}),
						(o.prototype._invmp = function (t) {
							e(0 === t.negative), e(!t.isZero());
							var r = this,
								i = t.clone();
							r = 0 !== r.negative ? r.umod(t) : r.clone();
							for (
								var n, s = new o(1), h = new o(0), u = i.clone();
								r.cmpn(1) > 0 && i.cmpn(1) > 0;

							) {
								for (var a = 0, l = 1; 0 == (r.words[0] & l) && a < 26; ++a, l <<= 1);
								if (a > 0) for (r.iushrn(a); a-- > 0; ) s.isOdd() && s.iadd(u), s.iushrn(1);
								for (var f = 0, m = 1; 0 == (i.words[0] & m) && f < 26; ++f, m <<= 1);
								if (f > 0) for (i.iushrn(f); f-- > 0; ) h.isOdd() && h.iadd(u), h.iushrn(1);
								r.cmp(i) >= 0 ? (r.isub(i), s.isub(h)) : (i.isub(r), h.isub(s));
							}
							return (n = 0 === r.cmpn(1) ? s : h).cmpn(0) < 0 && n.iadd(t), n;
						}),
						(o.prototype.gcd = function (t) {
							if (this.isZero()) return t.abs();
							if (t.isZero()) return this.abs();
							var r = this.clone(),
								i = t.clone();
							(r.negative = 0), (i.negative = 0);
							for (var e = 0; r.isEven() && i.isEven(); e++) r.iushrn(1), i.iushrn(1);
							for (;;) {
								for (; r.isEven(); ) r.iushrn(1);
								for (; i.isEven(); ) i.iushrn(1);
								var n = r.cmp(i);
								if (n < 0) {
									var o = r;
									(r = i), (i = o);
								} else if (0 === n || 0 === i.cmpn(1)) break;
								r.isub(i);
							}
							return i.iushln(e);
						}),
						(o.prototype.invm = function (t) {
							return this.egcd(t).a.umod(t);
						}),
						(o.prototype.isEven = function () {
							return 0 == (1 & this.words[0]);
						}),
						(o.prototype.isOdd = function () {
							return 1 == (1 & this.words[0]);
						}),
						(o.prototype.andln = function (t) {
							return this.words[0] & t;
						}),
						(o.prototype.bincn = function (t) {
							e('number' == typeof t);
							var r = t % 26,
								i = (t - r) / 26,
								n = 1 << r;
							if (this.length <= i) return this._expand(i + 1), (this.words[i] |= n), this;
							for (var o = n, s = i; 0 !== o && s < this.length; s++) {
								var h = 0 | this.words[s];
								(o = (h += o) >>> 26), (h &= 67108863), (this.words[s] = h);
							}
							return 0 !== o && ((this.words[s] = o), this.length++), this;
						}),
						(o.prototype.isZero = function () {
							return 1 === this.length && 0 === this.words[0];
						}),
						(o.prototype.cmpn = function (t) {
							var r,
								i = t < 0;
							if (0 !== this.negative && !i) return -1;
							if (0 === this.negative && i) return 1;
							if ((this.strip(), this.length > 1)) r = 1;
							else {
								i && (t = -t), e(t <= 67108863, 'Number is too big');
								var n = 0 | this.words[0];
								r = n === t ? 0 : n < t ? -1 : 1;
							}
							return 0 !== this.negative ? 0 | -r : r;
						}),
						(o.prototype.cmp = function (t) {
							if (0 !== this.negative && 0 === t.negative) return -1;
							if (0 === this.negative && 0 !== t.negative) return 1;
							var r = this.ucmp(t);
							return 0 !== this.negative ? 0 | -r : r;
						}),
						(o.prototype.ucmp = function (t) {
							if (this.length > t.length) return 1;
							if (this.length < t.length) return -1;
							for (var r = 0, i = this.length - 1; i >= 0; i--) {
								var e = 0 | this.words[i],
									n = 0 | t.words[i];
								if (e !== n) {
									e < n ? (r = -1) : e > n && (r = 1);
									break;
								}
							}
							return r;
						}),
						(o.prototype.gtn = function (t) {
							return 1 === this.cmpn(t);
						}),
						(o.prototype.gt = function (t) {
							return 1 === this.cmp(t);
						}),
						(o.prototype.gten = function (t) {
							return this.cmpn(t) >= 0;
						}),
						(o.prototype.gte = function (t) {
							return this.cmp(t) >= 0;
						}),
						(o.prototype.ltn = function (t) {
							return -1 === this.cmpn(t);
						}),
						(o.prototype.lt = function (t) {
							return -1 === this.cmp(t);
						}),
						(o.prototype.lten = function (t) {
							return this.cmpn(t) <= 0;
						}),
						(o.prototype.lte = function (t) {
							return this.cmp(t) <= 0;
						}),
						(o.prototype.eqn = function (t) {
							return 0 === this.cmpn(t);
						}),
						(o.prototype.eq = function (t) {
							return 0 === this.cmp(t);
						}),
						(o.red = function (t) {
							return new _(t);
						}),
						(o.prototype.toRed = function (t) {
							return (
								e(!this.red, 'Already a number in reduction context'),
								e(0 === this.negative, 'red works only with positives'),
								t.convertTo(this)._forceRed(t)
							);
						}),
						(o.prototype.fromRed = function () {
							return (
								e(this.red, 'fromRed works only with numbers in reduction context'),
								this.red.convertFrom(this)
							);
						}),
						(o.prototype._forceRed = function (t) {
							return (this.red = t), this;
						}),
						(o.prototype.forceRed = function (t) {
							return e(!this.red, 'Already a number in reduction context'), this._forceRed(t);
						}),
						(o.prototype.redAdd = function (t) {
							return e(this.red, 'redAdd works only with red numbers'), this.red.add(this, t);
						}),
						(o.prototype.redIAdd = function (t) {
							return e(this.red, 'redIAdd works only with red numbers'), this.red.iadd(this, t);
						}),
						(o.prototype.redSub = function (t) {
							return e(this.red, 'redSub works only with red numbers'), this.red.sub(this, t);
						}),
						(o.prototype.redISub = function (t) {
							return e(this.red, 'redISub works only with red numbers'), this.red.isub(this, t);
						}),
						(o.prototype.redShl = function (t) {
							return e(this.red, 'redShl works only with red numbers'), this.red.shl(this, t);
						}),
						(o.prototype.redMul = function (t) {
							return (
								e(this.red, 'redMul works only with red numbers'),
								this.red._verify2(this, t),
								this.red.mul(this, t)
							);
						}),
						(o.prototype.redIMul = function (t) {
							return (
								e(this.red, 'redMul works only with red numbers'),
								this.red._verify2(this, t),
								this.red.imul(this, t)
							);
						}),
						(o.prototype.redSqr = function () {
							return (
								e(this.red, 'redSqr works only with red numbers'),
								this.red._verify1(this),
								this.red.sqr(this)
							);
						}),
						(o.prototype.redISqr = function () {
							return (
								e(this.red, 'redISqr works only with red numbers'),
								this.red._verify1(this),
								this.red.isqr(this)
							);
						}),
						(o.prototype.redSqrt = function () {
							return (
								e(this.red, 'redSqrt works only with red numbers'),
								this.red._verify1(this),
								this.red.sqrt(this)
							);
						}),
						(o.prototype.redInvm = function () {
							return (
								e(this.red, 'redInvm works only with red numbers'),
								this.red._verify1(this),
								this.red.invm(this)
							);
						}),
						(o.prototype.redNeg = function () {
							return (
								e(this.red, 'redNeg works only with red numbers'),
								this.red._verify1(this),
								this.red.neg(this)
							);
						}),
						(o.prototype.redPow = function (t) {
							return (
								e(this.red && !t.red, 'redPow(normalNum)'),
								this.red._verify1(this),
								this.red.pow(this, t)
							);
						});
					var g = { k256: null, p224: null, p192: null, p25519: null };
					function v(t, r) {
						(this.name = t),
							(this.p = new o(r, 16)),
							(this.n = this.p.bitLength()),
							(this.k = new o(1).iushln(this.n).isub(this.p)),
							(this.tmp = this._tmp());
					}
					function y() {
						v.call(
							this,
							'k256',
							'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f'
						);
					}
					function w() {
						v.call(this, 'p224', 'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001');
					}
					function M() {
						v.call(this, 'p192', 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff');
					}
					function b() {
						v.call(
							this,
							'25519',
							'7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed'
						);
					}
					function _(t) {
						if ('string' == typeof t) {
							var r = o._prime(t);
							(this.m = r.p), (this.prime = r);
						} else e(t.gtn(1), 'modulus must be greater than 1'), (this.m = t), (this.prime = null);
					}
					function A(t) {
						_.call(this, t),
							(this.shift = this.m.bitLength()),
							this.shift % 26 != 0 && (this.shift += 26 - (this.shift % 26)),
							(this.r = new o(1).iushln(this.shift)),
							(this.r2 = this.imod(this.r.sqr())),
							(this.rinv = this.r._invmp(this.m)),
							(this.minv = this.rinv.mul(this.r).isubn(1).div(this.m)),
							(this.minv = this.minv.umod(this.r)),
							(this.minv = this.r.sub(this.minv));
					}
					(v.prototype._tmp = function () {
						var t = new o(null);
						return (t.words = new Array(Math.ceil(this.n / 13))), t;
					}),
						(v.prototype.ireduce = function (t) {
							var r,
								i = t;
							do {
								this.split(i, this.tmp), (r = (i = (i = this.imulK(i)).iadd(this.tmp)).bitLength());
							} while (r > this.n);
							var e = r < this.n ? -1 : i.ucmp(this.p);
							return (
								0 === e ? ((i.words[0] = 0), (i.length = 1)) : e > 0 ? i.isub(this.p) : i.strip(), i
							);
						}),
						(v.prototype.split = function (t, r) {
							t.iushrn(this.n, 0, r);
						}),
						(v.prototype.imulK = function (t) {
							return t.imul(this.k);
						}),
						n(y, v),
						(y.prototype.split = function (t, r) {
							for (var i = Math.min(t.length, 9), e = 0; e < i; e++) r.words[e] = t.words[e];
							if (((r.length = i), t.length <= 9)) return (t.words[0] = 0), void (t.length = 1);
							var n = t.words[9];
							for (r.words[r.length++] = 4194303 & n, e = 10; e < t.length; e++) {
								var o = 0 | t.words[e];
								(t.words[e - 10] = ((4194303 & o) << 4) | (n >>> 22)), (n = o);
							}
							(n >>>= 22),
								(t.words[e - 10] = n),
								0 === n && t.length > 10 ? (t.length -= 10) : (t.length -= 9);
						}),
						(y.prototype.imulK = function (t) {
							(t.words[t.length] = 0), (t.words[t.length + 1] = 0), (t.length += 2);
							for (var r = 0, i = 0; i < t.length; i++) {
								var e = 0 | t.words[i];
								(r += 977 * e), (t.words[i] = 67108863 & r), (r = 64 * e + ((r / 67108864) | 0));
							}
							return (
								0 === t.words[t.length - 1] &&
									(t.length--, 0 === t.words[t.length - 1] && t.length--),
								t
							);
						}),
						n(w, v),
						n(M, v),
						n(b, v),
						(b.prototype.imulK = function (t) {
							for (var r = 0, i = 0; i < t.length; i++) {
								var e = 19 * (0 | t.words[i]) + r,
									n = 67108863 & e;
								(e >>>= 26), (t.words[i] = n), (r = e);
							}
							return 0 !== r && (t.words[t.length++] = r), t;
						}),
						(o._prime = function (t) {
							if (g[t]) return g[t];
							var r;
							if ('k256' === t) r = new y();
							else if ('p224' === t) r = new w();
							else if ('p192' === t) r = new M();
							else {
								if ('p25519' !== t) throw new Error('Unknown prime ' + t);
								r = new b();
							}
							return (g[t] = r), r;
						}),
						(_.prototype._verify1 = function (t) {
							e(0 === t.negative, 'red works only with positives'),
								e(t.red, 'red works only with red numbers');
						}),
						(_.prototype._verify2 = function (t, r) {
							e(0 == (t.negative | r.negative), 'red works only with positives'),
								e(t.red && t.red === r.red, 'red works only with red numbers');
						}),
						(_.prototype.imod = function (t) {
							return this.prime
								? this.prime.ireduce(t)._forceRed(this)
								: t.umod(this.m)._forceRed(this);
						}),
						(_.prototype.neg = function (t) {
							return t.isZero() ? t.clone() : this.m.sub(t)._forceRed(this);
						}),
						(_.prototype.add = function (t, r) {
							this._verify2(t, r);
							var i = t.add(r);
							return i.cmp(this.m) >= 0 && i.isub(this.m), i._forceRed(this);
						}),
						(_.prototype.iadd = function (t, r) {
							this._verify2(t, r);
							var i = t.iadd(r);
							return i.cmp(this.m) >= 0 && i.isub(this.m), i;
						}),
						(_.prototype.sub = function (t, r) {
							this._verify2(t, r);
							var i = t.sub(r);
							return i.cmpn(0) < 0 && i.iadd(this.m), i._forceRed(this);
						}),
						(_.prototype.isub = function (t, r) {
							this._verify2(t, r);
							var i = t.isub(r);
							return i.cmpn(0) < 0 && i.iadd(this.m), i;
						}),
						(_.prototype.shl = function (t, r) {
							return this._verify1(t), this.imod(t.ushln(r));
						}),
						(_.prototype.imul = function (t, r) {
							return this._verify2(t, r), this.imod(t.imul(r));
						}),
						(_.prototype.mul = function (t, r) {
							return this._verify2(t, r), this.imod(t.mul(r));
						}),
						(_.prototype.isqr = function (t) {
							return this.imul(t, t.clone());
						}),
						(_.prototype.sqr = function (t) {
							return this.mul(t, t);
						}),
						(_.prototype.sqrt = function (t) {
							if (t.isZero()) return t.clone();
							var r = this.m.andln(3);
							if ((e(r % 2 == 1), 3 === r)) {
								var i = this.m.add(new o(1)).iushrn(2);
								return this.pow(t, i);
							}
							for (var n = this.m.subn(1), s = 0; !n.isZero() && 0 === n.andln(1); )
								s++, n.iushrn(1);
							e(!n.isZero());
							var h = new o(1).toRed(this),
								u = h.redNeg(),
								a = this.m.subn(1).iushrn(1),
								l = this.m.bitLength();
							for (l = new o(2 * l * l).toRed(this); 0 !== this.pow(l, a).cmp(u); ) l.redIAdd(u);
							for (
								var f = this.pow(l, n),
									m = this.pow(t, n.addn(1).iushrn(1)),
									c = this.pow(t, n),
									d = s;
								0 !== c.cmp(h);

							) {
								for (var p = c, g = 0; 0 !== p.cmp(h); g++) p = p.redSqr();
								e(g < d);
								var v = this.pow(f, new o(1).iushln(d - g - 1));
								(m = m.redMul(v)), (f = v.redSqr()), (c = c.redMul(f)), (d = g);
							}
							return m;
						}),
						(_.prototype.invm = function (t) {
							var r = t._invmp(this.m);
							return 0 !== r.negative ? ((r.negative = 0), this.imod(r).redNeg()) : this.imod(r);
						}),
						(_.prototype.pow = function (t, r) {
							if (r.isZero()) return new o(1).toRed(this);
							if (0 === r.cmpn(1)) return t.clone();
							var i = new Array(16);
							(i[0] = new o(1).toRed(this)), (i[1] = t);
							for (var e = 2; e < i.length; e++) i[e] = this.mul(i[e - 1], t);
							var n = i[0],
								s = 0,
								h = 0,
								u = r.bitLength() % 26;
							for (0 === u && (u = 26), e = r.length - 1; e >= 0; e--) {
								for (var a = r.words[e], l = u - 1; l >= 0; l--) {
									var f = (a >> l) & 1;
									n !== i[0] && (n = this.sqr(n)),
										0 !== f || 0 !== s
											? ((s <<= 1),
											  (s |= f),
											  (4 === ++h || (0 === e && 0 === l)) &&
													((n = this.mul(n, i[s])), (h = 0), (s = 0)))
											: (h = 0);
								}
								u = 26;
							}
							return n;
						}),
						(_.prototype.convertTo = function (t) {
							var r = t.umod(this.m);
							return r === t ? r.clone() : r;
						}),
						(_.prototype.convertFrom = function (t) {
							var r = t.clone();
							return (r.red = null), r;
						}),
						(o.mont = function (t) {
							return new A(t);
						}),
						n(A, _),
						(A.prototype.convertTo = function (t) {
							return this.imod(t.ushln(this.shift));
						}),
						(A.prototype.convertFrom = function (t) {
							var r = this.imod(t.mul(this.rinv));
							return (r.red = null), r;
						}),
						(A.prototype.imul = function (t, r) {
							if (t.isZero() || r.isZero()) return (t.words[0] = 0), (t.length = 1), t;
							var i = t.imul(r),
								e = i.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
								n = i.isub(e).iushrn(this.shift),
								o = n;
							return (
								n.cmp(this.m) >= 0 ? (o = n.isub(this.m)) : n.cmpn(0) < 0 && (o = n.iadd(this.m)),
								o._forceRed(this)
							);
						}),
						(A.prototype.mul = function (t, r) {
							if (t.isZero() || r.isZero()) return new o(0)._forceRed(this);
							var i = t.mul(r),
								e = i.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
								n = i.isub(e).iushrn(this.shift),
								s = n;
							return (
								n.cmp(this.m) >= 0 ? (s = n.isub(this.m)) : n.cmpn(0) < 0 && (s = n.iadd(this.m)),
								s._forceRed(this)
							);
						}),
						(A.prototype.invm = function (t) {
							return this.imod(t._invmp(this.m).mul(this.r2))._forceRed(this);
						});
				})(t, this);
			}.call(this, i(0)(t)));
		},
		function (t, r, i) {
			!(function (t) {
				var r,
					i,
					e,
					n = String.fromCharCode;
				function o(t) {
					for (var r, i, e = [], n = 0, o = t.length; n < o; )
						(r = t.charCodeAt(n++)) >= 55296 && r <= 56319 && n < o
							? 56320 == (64512 & (i = t.charCodeAt(n++)))
								? e.push(((1023 & r) << 10) + (1023 & i) + 65536)
								: (e.push(r), n--)
							: e.push(r);
					return e;
				}
				function s(t) {
					if (t >= 55296 && t <= 57343)
						throw Error(
							'Lone surrogate U+' + t.toString(16).toUpperCase() + ' is not a scalar value'
						);
				}
				function h(t, r) {
					return n(((t >> r) & 63) | 128);
				}
				function u(t) {
					if (0 == (4294967168 & t)) return n(t);
					var r = '';
					return (
						0 == (4294965248 & t)
							? (r = n(((t >> 6) & 31) | 192))
							: 0 == (4294901760 & t)
							? (s(t), (r = n(((t >> 12) & 15) | 224)), (r += h(t, 6)))
							: 0 == (4292870144 & t) &&
							  ((r = n(((t >> 18) & 7) | 240)), (r += h(t, 12)), (r += h(t, 6))),
						(r += n((63 & t) | 128))
					);
				}
				function a() {
					if (e >= i) throw Error('Invalid byte index');
					var t = 255 & r[e];
					if ((e++, 128 == (192 & t))) return 63 & t;
					throw Error('Invalid continuation byte');
				}
				function l() {
					var t, n;
					if (e > i) throw Error('Invalid byte index');
					if (e == i) return !1;
					if (((t = 255 & r[e]), e++, 0 == (128 & t))) return t;
					if (192 == (224 & t)) {
						if ((n = ((31 & t) << 6) | a()) >= 128) return n;
						throw Error('Invalid continuation byte');
					}
					if (224 == (240 & t)) {
						if ((n = ((15 & t) << 12) | (a() << 6) | a()) >= 2048) return s(n), n;
						throw Error('Invalid continuation byte');
					}
					if (
						240 == (248 & t) &&
						(n = ((7 & t) << 18) | (a() << 12) | (a() << 6) | a()) >= 65536 &&
						n <= 1114111
					)
						return n;
					throw Error('Invalid UTF-8 detected');
				}
				(t.version = '3.0.0'),
					(t.encode = function (t) {
						for (var r = o(t), i = r.length, e = -1, n = ''; ++e < i; ) n += u(r[e]);
						return n;
					}),
					(t.decode = function (t) {
						(r = o(t)), (i = r.length), (e = 0);
						for (var s, h = []; !1 !== (s = l()); ) h.push(s);
						return (function (t) {
							for (var r, i = t.length, e = -1, o = ''; ++e < i; )
								(r = t[e]) > 65535 &&
									((o += n((((r -= 65536) >>> 10) & 1023) | 55296)), (r = 56320 | (1023 & r))),
									(o += n(r));
							return o;
						})(h);
					});
			})(r);
		},
		function (t, r, i) {
			'use strict';
			Object.defineProperty(r, '__esModule', { value: !0 });
			const e = i(30);
			function n(t) {
				return (
					'string' == typeof t &&
					!!/^(0x)?[0-9a-f]{512}$/i.test(t) &&
					!(!/^(0x)?[0-9a-f]{512}$/.test(t) && !/^(0x)?[0-9A-F]{512}$/.test(t))
				);
			}
			function o(t, r) {
				'object' == typeof r && r.constructor === Uint8Array && (r = e.bytesToHex(r));
				const i = e.keccak256(r).replace('0x', '');
				for (let r = 0; r < 12; r += 4) {
					const e = ((parseInt(i.substr(r, 2), 16) << 8) + parseInt(i.substr(r + 2, 2), 16)) & 2047,
						n = 1 << e % 4;
					if ((s(t.charCodeAt(t.length - 1 - Math.floor(e / 4))) & n) !== n) return !1;
				}
				return !0;
			}
			function s(t) {
				if (t >= 48 && t <= 57) return t - 48;
				if (t >= 65 && t <= 70) return t - 55;
				if (t >= 97 && t <= 102) return t - 87;
				throw new Error('invalid bloom');
			}
			function h(t) {
				return (
					'string' == typeof t &&
					!!/^(0x)?[0-9a-f]{64}$/i.test(t) &&
					!(!/^(0x)?[0-9a-f]{64}$/.test(t) && !/^(0x)?[0-9A-F]{64}$/.test(t))
				);
			}
			function u(t) {
				return (
					'string' == typeof t &&
					(!!t.match(/^(0x)?[0-9a-fA-F]{40}$/) || !!t.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/))
				);
			}
			(r.isBloom = n),
				(r.isInBloom = o),
				(r.isUserEthereumAddressInBloom = function (t, r) {
					if (!n(t)) throw new Error('Invalid bloom given');
					if (!u(r)) throw new Error(`Invalid ethereum address given: "${r}"`);
					return o(t, e.padLeft(r, 64));
				}),
				(r.isContractAddressInBloom = function (t, r) {
					if (!n(t)) throw new Error('Invalid bloom given');
					if (!u(r)) throw new Error(`Invalid contract address given: "${r}"`);
					return o(t, r);
				}),
				(r.isTopicInBloom = function (t, r) {
					if (!n(t)) throw new Error('Invalid bloom given');
					if (!h(r)) throw new Error('Invalid topic');
					return o(t, r);
				}),
				(r.isTopic = h),
				(r.isAddress = u);
		},
		function (t, r) {
			var i,
				e,
				n = (t.exports = {});
			function o() {
				throw new Error('setTimeout has not been defined');
			}
			function s() {
				throw new Error('clearTimeout has not been defined');
			}
			function h(t) {
				if (i === setTimeout) return setTimeout(t, 0);
				if ((i === o || !i) && setTimeout) return (i = setTimeout), setTimeout(t, 0);
				try {
					return i(t, 0);
				} catch (r) {
					try {
						return i.call(null, t, 0);
					} catch (r) {
						return i.call(this, t, 0);
					}
				}
			}
			!(function () {
				try {
					i = 'function' == typeof setTimeout ? setTimeout : o;
				} catch (t) {
					i = o;
				}
				try {
					e = 'function' == typeof clearTimeout ? clearTimeout : s;
				} catch (t) {
					e = s;
				}
			})();
			var u,
				a = [],
				l = !1,
				f = -1;
			function m() {
				l && u && ((l = !1), u.length ? (a = u.concat(a)) : (f = -1), a.length && c());
			}
			function c() {
				if (!l) {
					var t = h(m);
					l = !0;
					for (var r = a.length; r; ) {
						for (u = a, a = []; ++f < r; ) u && u[f].run();
						(f = -1), (r = a.length);
					}
					(u = null),
						(l = !1),
						(function (t) {
							if (e === clearTimeout) return clearTimeout(t);
							if ((e === s || !e) && clearTimeout) return (e = clearTimeout), clearTimeout(t);
							try {
								e(t);
							} catch (r) {
								try {
									return e.call(null, t);
								} catch (r) {
									return e.call(this, t);
								}
							}
						})(t);
				}
			}
			function d(t, r) {
				(this.fun = t), (this.array = r);
			}
			function p() {}
			(n.nextTick = function (t) {
				var r = new Array(arguments.length - 1);
				if (arguments.length > 1)
					for (var i = 1; i < arguments.length; i++) r[i - 1] = arguments[i];
				a.push(new d(t, r)), 1 !== a.length || l || h(c);
			}),
				(d.prototype.run = function () {
					this.fun.apply(null, this.array);
				}),
				(n.title = 'browser'),
				(n.browser = !0),
				(n.env = {}),
				(n.argv = []),
				(n.version = ''),
				(n.versions = {}),
				(n.on = p),
				(n.addListener = p),
				(n.once = p),
				(n.off = p),
				(n.removeListener = p),
				(n.removeAllListeners = p),
				(n.emit = p),
				(n.prependListener = p),
				(n.prependOnceListener = p),
				(n.listeners = function (t) {
					return [];
				}),
				(n.binding = function (t) {
					throw new Error('process.binding is not supported');
				}),
				(n.cwd = function () {
					return '/';
				}),
				(n.chdir = function (t) {
					throw new Error('process.chdir is not supported');
				}),
				(n.umask = function () {
					return 0;
				});
		},
		function (t, r, i) {
			'use strict';
			(function (r, e) {
				var n = i(33).Buffer,
					o = r.crypto || r.msCrypto;
				o && o.getRandomValues
					? (t.exports = function (t, r) {
							if (t > 4294967295) throw new RangeError('requested too many random bytes');
							var i = n.allocUnsafe(t);
							if (t > 0)
								if (t > 65536)
									for (var s = 0; s < t; s += 65536) o.getRandomValues(i.slice(s, s + 65536));
								else o.getRandomValues(i);
							if ('function' == typeof r)
								return e.nextTick(function () {
									r(null, i);
								});
							return i;
					  })
					: (t.exports = function () {
							throw new Error(
								'Secure random number generation is not supported by this browser.\nUse Chrome, Firefox or Internet Explorer 11'
							);
					  });
			}.call(this, i(3), i(14)));
		},
		function (t, r, i) {
			(function (r) {
				var e = i(6),
					n = i(5),
					o = i(12),
					s = i(38),
					h = i(13),
					u = function (t) {
						return e.isBN(t);
					},
					a = function (t) {
						return t && t.constructor && 'BigNumber' === t.constructor.name;
					},
					l = function (t) {
						try {
							return n.apply(null, arguments);
						} catch (r) {
							throw new Error(r + ' Given value: "' + t + '"');
						}
					},
					f = function (t) {
						return (
							!!/^(0x)?[0-9a-f]{40}$/i.test(t) &&
							(!(!/^(0x|0X)?[0-9a-f]{40}$/.test(t) && !/^(0x|0X)?[0-9A-F]{40}$/.test(t)) || m(t))
						);
					},
					m = function (t) {
						t = t.replace(/^0x/i, '');
						for (var r = b(t.toLowerCase()).replace(/^0x/i, ''), i = 0; i < 40; i++)
							if (
								(parseInt(r[i], 16) > 7 && t[i].toUpperCase() !== t[i]) ||
								(parseInt(r[i], 16) <= 7 && t[i].toLowerCase() !== t[i])
							)
								return !1;
						return !0;
					},
					c = function (t) {
						var r = '';
						t = (t = (t = (t = (t = o.encode(t)).replace(/^(?:\u0000)*/, ''))
							.split('')
							.reverse()
							.join('')).replace(/^(?:\u0000)*/, ''))
							.split('')
							.reverse()
							.join('');
						for (var i = 0; i < t.length; i++) {
							var e = t.charCodeAt(i).toString(16);
							r += e.length < 2 ? '0' + e : e;
						}
						return '0x' + r;
					},
					d = function (t) {
						if (!t) return t;
						if ('string' == typeof t && !y(t))
							throw new Error('Given value "' + t + '" is not a valid hex string.');
						return l(t).toNumber();
					},
					p = function (t) {
						if (null == t) return t;
						if (!isFinite(t) && !y(t)) throw new Error('Given input "' + t + '" is not a number.');
						var r = l(t),
							i = r.toString(16);
						return r.lt(new e(0)) ? '-0x' + i.substr(1) : '0x' + i;
					},
					g = function (t) {
						if (((t = t.toString(16)), !y(t)))
							throw new Error('Given value "' + t + '" is not a valid hex string.');
						t = t.replace(/^0x/i, '');
						for (var r = [], i = 0; i < t.length; i += 2) r.push(parseInt(t.substr(i, 2), 16));
						return r;
					},
					v = function (t, i) {
						if (f(t)) return i ? 'address' : '0x' + t.toLowerCase().replace(/^0x/i, '');
						if ('boolean' == typeof t) return i ? 'bool' : t ? '0x01' : '0x00';
						if (r.isBuffer(t)) return '0x' + t.toString('hex');
						if ('object' == typeof t && t && !a(t) && !u(t))
							return i ? 'string' : c(JSON.stringify(t));
						if ('string' == typeof t) {
							if (0 === t.indexOf('-0x') || 0 === t.indexOf('-0X')) return i ? 'int256' : p(t);
							if (0 === t.indexOf('0x') || 0 === t.indexOf('0X')) return i ? 'bytes' : t;
							if (!isFinite(t)) return i ? 'string' : c(t);
						}
						return i ? (t < 0 ? 'int256' : 'uint256') : p(t);
					},
					y = function (t) {
						return ('string' == typeof t || 'number' == typeof t) && /^(-)?0x[0-9a-f]*$/i.test(t);
					},
					w = function (t) {
						return (
							('string' == typeof t || 'number' == typeof t) && /^(-0x|0x)?[0-9a-f]*$/i.test(t)
						);
					},
					M = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
					b = function (t) {
						u(t) && (t = t.toString()), y(t) && /^0x/i.test(t.toString()) && (t = g(t));
						var r = s.keccak256(t);
						return r === M ? null : r;
					};
				b._Hash = s;
				t.exports = {
					BN: e,
					isBN: u,
					isBigNumber: a,
					toBN: l,
					isAddress: f,
					isBloom: function (t) {
						return h.isBloom(t);
					},
					isUserEthereumAddressInBloom: function (t, r) {
						return h.isUserEthereumAddressInBloom(t, r);
					},
					isContractAddressInBloom: function (t, r) {
						return h.isContractAddressInBloom(t, r);
					},
					isTopic: function (t) {
						return h.isTopic(t);
					},
					isTopicInBloom: function (t, r) {
						return h.isTopicInBloom(t, r);
					},
					isInBloom: function (t, r) {
						return h.isInBloom(t, r);
					},
					checkAddressChecksum: m,
					utf8ToHex: c,
					hexToUtf8: function (t) {
						if (!y(t)) throw new Error('The parameter "' + t + '" must be a valid HEX string.');
						for (
							var r = '',
								i = 0,
								e = (t = (t = (t = (t = (t = t.replace(/^0x/i, '')).replace(/^(?:00)*/, ''))
									.split('')
									.reverse()
									.join('')).replace(/^(?:00)*/, ''))
									.split('')
									.reverse()
									.join('')).length,
								n = 0;
							n < e;
							n += 2
						)
							(i = parseInt(t.substr(n, 2), 16)), (r += String.fromCharCode(i));
						return o.decode(r);
					},
					hexToNumber: d,
					hexToNumberString: function (t) {
						if (!t) return t;
						if ('string' == typeof t && !y(t))
							throw new Error('Given value "' + t + '" is not a valid hex string.');
						return l(t).toString(10);
					},
					numberToHex: p,
					toHex: v,
					hexToBytes: g,
					bytesToHex: function (t) {
						for (var r = [], i = 0; i < t.length; i++)
							r.push((t[i] >>> 4).toString(16)), r.push((15 & t[i]).toString(16));
						return '0x' + r.join('');
					},
					isHex: w,
					isHexStrict: y,
					stripHexPrefix: function (t) {
						return 0 !== t && w(t) ? t.replace(/^(-)?0x/i, '$1') : t;
					},
					leftPad: function (t, r, i) {
						var e = /^0x/i.test(t) || 'number' == typeof t,
							n =
								r - (t = t.toString(16).replace(/^0x/i, '')).length + 1 >= 0 ? r - t.length + 1 : 0;
						return (e ? '0x' : '') + new Array(n).join(i || '0') + t;
					},
					rightPad: function (t, r, i) {
						var e = /^0x/i.test(t) || 'number' == typeof t,
							n =
								r - (t = t.toString(16).replace(/^0x/i, '')).length + 1 >= 0 ? r - t.length + 1 : 0;
						return (e ? '0x' : '') + t + new Array(n).join(i || '0');
					},
					toTwosComplement: function (t) {
						return '0x' + l(t).toTwos(256).toString(16, 64);
					},
					sha3: b,
					sha3Raw: function (t) {
						return null === (t = b(t)) ? M : t;
					},
					toNumber: function (t) {
						return 'number' == typeof t ? t : d(v(t));
					},
				};
			}.call(this, i(1).Buffer));
		},
		function (t, r, i) {
			'use strict';
			i.r(r),
				i.d(r, 'ConstructorFragment', function () {
					return et;
				}),
				i.d(r, 'EventFragment', function () {
					return Q;
				}),
				i.d(r, 'Fragment', function () {
					return X;
				}),
				i.d(r, 'FunctionFragment', function () {
					return nt;
				}),
				i.d(r, 'ParamType', function () {
					return J;
				}),
				i.d(r, 'FormatTypes', function () {
					return $;
				}),
				i.d(r, 'AbiCoder', function () {
					return Qt;
				}),
				i.d(r, 'defaultAbiCoder', function () {
					return tr;
				}),
				i.d(r, 'Interface', function () {
					return hr;
				}),
				i.d(r, 'Indexed', function () {
					return or;
				}),
				i.d(r, 'checkResultErrors', function () {
					return lt;
				}),
				i.d(r, 'LogDescription', function () {
					return er;
				}),
				i.d(r, 'TransactionDescription', function () {
					return nr;
				});
			var e = i(18),
				n = i.n(e);
			let o = !1,
				s = !1;
			const h = { debug: 1, default: 2, info: 2, warning: 3, error: 4, off: 5 };
			let u = h.default,
				a = null;
			const l = (function () {
				try {
					const t = [];
					if (
						(['NFD', 'NFC', 'NFKD', 'NFKC'].forEach((r) => {
							try {
								if ('test' !== 'test'.normalize(r)) throw new Error('bad normalize');
							} catch (i) {
								t.push(r);
							}
						}),
						t.length)
					)
						throw new Error('missing ' + t.join(', '));
					if (String.fromCharCode(233).normalize('NFD') !== String.fromCharCode(101, 769))
						throw new Error('broken implementation');
				} catch (t) {
					return t.message;
				}
				return null;
			})();
			var f, m;
			!(function (t) {
				(t.DEBUG = 'DEBUG'),
					(t.INFO = 'INFO'),
					(t.WARNING = 'WARNING'),
					(t.ERROR = 'ERROR'),
					(t.OFF = 'OFF');
			})(f || (f = {})),
				(function (t) {
					(t.UNKNOWN_ERROR = 'UNKNOWN_ERROR'),
						(t.NOT_IMPLEMENTED = 'NOT_IMPLEMENTED'),
						(t.UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION'),
						(t.NETWORK_ERROR = 'NETWORK_ERROR'),
						(t.SERVER_ERROR = 'SERVER_ERROR'),
						(t.TIMEOUT = 'TIMEOUT'),
						(t.BUFFER_OVERRUN = 'BUFFER_OVERRUN'),
						(t.NUMERIC_FAULT = 'NUMERIC_FAULT'),
						(t.MISSING_NEW = 'MISSING_NEW'),
						(t.INVALID_ARGUMENT = 'INVALID_ARGUMENT'),
						(t.MISSING_ARGUMENT = 'MISSING_ARGUMENT'),
						(t.UNEXPECTED_ARGUMENT = 'UNEXPECTED_ARGUMENT'),
						(t.CALL_EXCEPTION = 'CALL_EXCEPTION'),
						(t.INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS'),
						(t.NONCE_EXPIRED = 'NONCE_EXPIRED'),
						(t.REPLACEMENT_UNDERPRICED = 'REPLACEMENT_UNDERPRICED'),
						(t.UNPREDICTABLE_GAS_LIMIT = 'UNPREDICTABLE_GAS_LIMIT'),
						(t.TRANSACTION_REPLACED = 'TRANSACTION_REPLACED'),
						(t.ACTION_REJECTED = 'ACTION_REJECTED');
				})(m || (m = {}));
			const c = '0123456789abcdef';
			class d {
				constructor(t) {
					Object.defineProperty(this, 'version', { enumerable: !0, value: t, writable: !1 });
				}
				_log(t, r) {
					const i = t.toLowerCase();
					null == h[i] && this.throwArgumentError('invalid log level name', 'logLevel', t),
						u > h[i] || console.log.apply(console, r);
				}
				debug(...t) {
					this._log(d.levels.DEBUG, t);
				}
				info(...t) {
					this._log(d.levels.INFO, t);
				}
				warn(...t) {
					this._log(d.levels.WARNING, t);
				}
				makeError(t, r, i) {
					if (s) return this.makeError('censored error', r, {});
					r || (r = d.errors.UNKNOWN_ERROR), i || (i = {});
					const e = [];
					Object.keys(i).forEach((t) => {
						const r = i[t];
						try {
							if (r instanceof Uint8Array) {
								let i = '';
								for (let t = 0; t < r.length; t++) (i += c[r[t] >> 4]), (i += c[15 & r[t]]);
								e.push(t + '=Uint8Array(0x' + i + ')');
							} else e.push(t + '=' + JSON.stringify(r));
						} catch (r) {
							e.push(t + '=' + JSON.stringify(i[t].toString()));
						}
					}),
						e.push('code=' + r),
						e.push('version=' + this.version);
					const n = t;
					let o = '';
					switch (r) {
						case m.NUMERIC_FAULT: {
							o = 'NUMERIC_FAULT';
							const r = t;
							switch (r) {
								case 'overflow':
								case 'underflow':
								case 'division-by-zero':
									o += '-' + r;
									break;
								case 'negative-power':
								case 'negative-width':
									o += '-unsupported';
									break;
								case 'unbound-bitwise-result':
									o += '-unbound-result';
							}
							break;
						}
						case m.CALL_EXCEPTION:
						case m.INSUFFICIENT_FUNDS:
						case m.MISSING_NEW:
						case m.NONCE_EXPIRED:
						case m.REPLACEMENT_UNDERPRICED:
						case m.TRANSACTION_REPLACED:
						case m.UNPREDICTABLE_GAS_LIMIT:
							o = r;
					}
					o && (t += ' [ See: https://links.ethers.org/v5-errors-' + o + ' ]'),
						e.length && (t += ' (' + e.join(', ') + ')');
					const h = new Error(t);
					return (
						(h.reason = n),
						(h.code = r),
						Object.keys(i).forEach(function (t) {
							h[t] = i[t];
						}),
						h
					);
				}
				throwError(t, r, i) {
					throw this.makeError(t, r, i);
				}
				throwArgumentError(t, r, i) {
					return this.throwError(t, d.errors.INVALID_ARGUMENT, { argument: r, value: i });
				}
				assert(t, r, i, e) {
					t || this.throwError(r, i, e);
				}
				assertArgument(t, r, i, e) {
					t || this.throwArgumentError(r, i, e);
				}
				checkNormalize(t) {
					null == t && (t = 'platform missing String.prototype.normalize'),
						l &&
							this.throwError(
								'platform missing String.prototype.normalize',
								d.errors.UNSUPPORTED_OPERATION,
								{ operation: 'String.prototype.normalize', form: l }
							);
				}
				checkSafeUint53(t, r) {
					'number' == typeof t &&
						(null == r && (r = 'value not safe'),
						(t < 0 || t >= 9007199254740991) &&
							this.throwError(r, d.errors.NUMERIC_FAULT, {
								operation: 'checkSafeInteger',
								fault: 'out-of-safe-range',
								value: t,
							}),
						t % 1 &&
							this.throwError(r, d.errors.NUMERIC_FAULT, {
								operation: 'checkSafeInteger',
								fault: 'non-integer',
								value: t,
							}));
				}
				checkArgumentCount(t, r, i) {
					(i = i ? ': ' + i : ''),
						t < r &&
							this.throwError('missing argument' + i, d.errors.MISSING_ARGUMENT, {
								count: t,
								expectedCount: r,
							}),
						t > r &&
							this.throwError('too many arguments' + i, d.errors.UNEXPECTED_ARGUMENT, {
								count: t,
								expectedCount: r,
							});
				}
				checkNew(t, r) {
					(t !== Object && null != t) ||
						this.throwError('missing new', d.errors.MISSING_NEW, { name: r.name });
				}
				checkAbstract(t, r) {
					t === r
						? this.throwError(
								'cannot instantiate abstract class ' +
									JSON.stringify(r.name) +
									' directly; use a sub-class',
								d.errors.UNSUPPORTED_OPERATION,
								{ name: t.name, operation: 'new' }
						  )
						: (t !== Object && null != t) ||
						  this.throwError('missing new', d.errors.MISSING_NEW, { name: r.name });
				}
				static globalLogger() {
					return a || (a = new d('logger/5.7.0')), a;
				}
				static setCensorship(t, r) {
					if (
						(!t &&
							r &&
							this.globalLogger().throwError(
								'cannot permanently disable censorship',
								d.errors.UNSUPPORTED_OPERATION,
								{ operation: 'setCensorship' }
							),
						o)
					) {
						if (!t) return;
						this.globalLogger().throwError(
							'error censorship permanent',
							d.errors.UNSUPPORTED_OPERATION,
							{ operation: 'setCensorship' }
						);
					}
					(s = !!t), (o = !!r);
				}
				static setLogLevel(t) {
					const r = h[t.toLowerCase()];
					null != r ? (u = r) : d.globalLogger().warn('invalid log level - ' + t);
				}
				static from(t) {
					return new d(t);
				}
			}
			(d.errors = m), (d.levels = f);
			const p = new d('bytes/5.7.0');
			function g(t) {
				return !!t.toHexString;
			}
			function v(t) {
				return (
					t.slice ||
						(t.slice = function () {
							const r = Array.prototype.slice.call(arguments);
							return v(new Uint8Array(Array.prototype.slice.apply(t, r)));
						}),
					t
				);
			}
			function y(t) {
				return 'number' == typeof t && t == t && t % 1 == 0;
			}
			function w(t) {
				if (null == t) return !1;
				if (t.constructor === Uint8Array) return !0;
				if ('string' == typeof t) return !1;
				if (!y(t.length) || t.length < 0) return !1;
				for (let r = 0; r < t.length; r++) {
					const i = t[r];
					if (!y(i) || i < 0 || i >= 256) return !1;
				}
				return !0;
			}
			function M(t, r) {
				if ((r || (r = {}), 'number' == typeof t)) {
					p.checkSafeUint53(t, 'invalid arrayify value');
					const r = [];
					for (; t; ) r.unshift(255 & t), (t = parseInt(String(t / 256)));
					return 0 === r.length && r.push(0), v(new Uint8Array(r));
				}
				if (
					(r.allowMissingPrefix &&
						'string' == typeof t &&
						'0x' !== t.substring(0, 2) &&
						(t = '0x' + t),
					g(t) && (t = t.toHexString()),
					_(t))
				) {
					let i = t.substring(2);
					i.length % 2 &&
						('left' === r.hexPad
							? (i = '0' + i)
							: 'right' === r.hexPad
							? (i += '0')
							: p.throwArgumentError('hex data is odd-length', 'value', t));
					const e = [];
					for (let t = 0; t < i.length; t += 2) e.push(parseInt(i.substring(t, t + 2), 16));
					return v(new Uint8Array(e));
				}
				return w(t)
					? v(new Uint8Array(t))
					: p.throwArgumentError('invalid arrayify value', 'value', t);
			}
			function b(t) {
				const r = t.map((t) => M(t)),
					i = r.reduce((t, r) => t + r.length, 0),
					e = new Uint8Array(i);
				return r.reduce((t, r) => (e.set(r, t), t + r.length), 0), v(e);
			}
			function _(t, r) {
				return (
					!('string' != typeof t || !t.match(/^0x[0-9A-Fa-f]*$/)) && (!r || t.length === 2 + 2 * r)
				);
			}
			function A(t, r) {
				if ((r || (r = {}), 'number' == typeof t)) {
					p.checkSafeUint53(t, 'invalid hexlify value');
					let r = '';
					for (; t; ) (r = '0123456789abcdef'[15 & t] + r), (t = Math.floor(t / 16));
					return r.length ? (r.length % 2 && (r = '0' + r), '0x' + r) : '0x00';
				}
				if ('bigint' == typeof t) return (t = t.toString(16)).length % 2 ? '0x0' + t : '0x' + t;
				if (
					(r.allowMissingPrefix &&
						'string' == typeof t &&
						'0x' !== t.substring(0, 2) &&
						(t = '0x' + t),
					g(t))
				)
					return t.toHexString();
				if (_(t))
					return (
						t.length % 2 &&
							('left' === r.hexPad
								? (t = '0x0' + t.substring(2))
								: 'right' === r.hexPad
								? (t += '0')
								: p.throwArgumentError('hex data is odd-length', 'value', t)),
						t.toLowerCase()
					);
				if (w(t)) {
					let r = '0x';
					for (let i = 0; i < t.length; i++) {
						let e = t[i];
						r += '0123456789abcdef'[(240 & e) >> 4] + '0123456789abcdef'[15 & e];
					}
					return r;
				}
				return p.throwArgumentError('invalid hexlify value', 'value', t);
			}
			function E(t, r, i) {
				return (
					'string' != typeof t
						? (t = A(t))
						: (!_(t) || t.length % 2) && p.throwArgumentError('invalid hexData', 'value', t),
					(r = 2 + 2 * r),
					null != i ? '0x' + t.substring(r, 2 + 2 * i) : '0x' + t.substring(r)
				);
			}
			function x(t, r) {
				for (
					'string' != typeof t
						? (t = A(t))
						: _(t) || p.throwArgumentError('invalid hex string', 'value', t),
						t.length > 2 * r + 2 &&
							p.throwArgumentError('value out of range', 'value', arguments[1]);
					t.length < 2 * r + 2;

				)
					t = '0x0' + t.substring(2);
				return t;
			}
			var S = n.a.BN;
			const N = new d('bignumber/5.7.0'),
				T = {};
			let R = !1;
			class k {
				constructor(t, r) {
					t !== T &&
						N.throwError(
							'cannot call constructor directly; use BigNumber.from',
							d.errors.UNSUPPORTED_OPERATION,
							{ operation: 'new (BigNumber)' }
						),
						(this._hex = r),
						(this._isBigNumber = !0),
						Object.freeze(this);
				}
				fromTwos(t) {
					return B(O(this).fromTwos(t));
				}
				toTwos(t) {
					return B(O(this).toTwos(t));
				}
				abs() {
					return '-' === this._hex[0] ? k.from(this._hex.substring(1)) : this;
				}
				add(t) {
					return B(O(this).add(O(t)));
				}
				sub(t) {
					return B(O(this).sub(O(t)));
				}
				div(t) {
					return k.from(t).isZero() && C('division-by-zero', 'div'), B(O(this).div(O(t)));
				}
				mul(t) {
					return B(O(this).mul(O(t)));
				}
				mod(t) {
					const r = O(t);
					return r.isNeg() && C('division-by-zero', 'mod'), B(O(this).umod(r));
				}
				pow(t) {
					const r = O(t);
					return r.isNeg() && C('negative-power', 'pow'), B(O(this).pow(r));
				}
				and(t) {
					const r = O(t);
					return (
						(this.isNegative() || r.isNeg()) && C('unbound-bitwise-result', 'and'),
						B(O(this).and(r))
					);
				}
				or(t) {
					const r = O(t);
					return (
						(this.isNegative() || r.isNeg()) && C('unbound-bitwise-result', 'or'), B(O(this).or(r))
					);
				}
				xor(t) {
					const r = O(t);
					return (
						(this.isNegative() || r.isNeg()) && C('unbound-bitwise-result', 'xor'),
						B(O(this).xor(r))
					);
				}
				mask(t) {
					return (this.isNegative() || t < 0) && C('negative-width', 'mask'), B(O(this).maskn(t));
				}
				shl(t) {
					return (this.isNegative() || t < 0) && C('negative-width', 'shl'), B(O(this).shln(t));
				}
				shr(t) {
					return (this.isNegative() || t < 0) && C('negative-width', 'shr'), B(O(this).shrn(t));
				}
				eq(t) {
					return O(this).eq(O(t));
				}
				lt(t) {
					return O(this).lt(O(t));
				}
				lte(t) {
					return O(this).lte(O(t));
				}
				gt(t) {
					return O(this).gt(O(t));
				}
				gte(t) {
					return O(this).gte(O(t));
				}
				isNegative() {
					return '-' === this._hex[0];
				}
				isZero() {
					return O(this).isZero();
				}
				toNumber() {
					try {
						return O(this).toNumber();
					} catch (t) {
						C('overflow', 'toNumber', this.toString());
					}
					return null;
				}
				toBigInt() {
					try {
						return BigInt(this.toString());
					} catch (t) {}
					return N.throwError(
						'this platform does not support BigInt',
						d.errors.UNSUPPORTED_OPERATION,
						{ value: this.toString() }
					);
				}
				toString() {
					return (
						arguments.length > 0 &&
							(10 === arguments[0]
								? R ||
								  ((R = !0),
								  N.warn('BigNumber.toString does not accept any parameters; base-10 is assumed'))
								: 16 === arguments[0]
								? N.throwError(
										'BigNumber.toString does not accept any parameters; use bigNumber.toHexString()',
										d.errors.UNEXPECTED_ARGUMENT,
										{}
								  )
								: N.throwError(
										'BigNumber.toString does not accept parameters',
										d.errors.UNEXPECTED_ARGUMENT,
										{}
								  )),
						O(this).toString(10)
					);
				}
				toHexString() {
					return this._hex;
				}
				toJSON(t) {
					return { type: 'BigNumber', hex: this.toHexString() };
				}
				static from(t) {
					if (t instanceof k) return t;
					if ('string' == typeof t)
						return t.match(/^-?0x[0-9a-f]+$/i)
							? new k(T, I(t))
							: t.match(/^-?[0-9]+$/)
							? new k(T, I(new S(t)))
							: N.throwArgumentError('invalid BigNumber string', 'value', t);
					if ('number' == typeof t)
						return (
							t % 1 && C('underflow', 'BigNumber.from', t),
							(t >= 9007199254740991 || t <= -9007199254740991) &&
								C('overflow', 'BigNumber.from', t),
							k.from(String(t))
						);
					const r = t;
					if ('bigint' == typeof r) return k.from(r.toString());
					if (w(r)) return k.from(A(r));
					if (r)
						if (r.toHexString) {
							const t = r.toHexString();
							if ('string' == typeof t) return k.from(t);
						} else {
							let t = r._hex;
							if (
								(null == t && 'BigNumber' === r.type && (t = r.hex),
								'string' == typeof t && (_(t) || ('-' === t[0] && _(t.substring(1)))))
							)
								return k.from(t);
						}
					return N.throwArgumentError('invalid BigNumber value', 'value', t);
				}
				static isBigNumber(t) {
					return !(!t || !t._isBigNumber);
				}
			}
			function I(t) {
				if ('string' != typeof t) return I(t.toString(16));
				if ('-' === t[0])
					return (
						'-' === (t = t.substring(1))[0] && N.throwArgumentError('invalid hex', 'value', t),
						'0x00' === (t = I(t)) ? t : '-' + t
					);
				if (('0x' !== t.substring(0, 2) && (t = '0x' + t), '0x' === t)) return '0x00';
				for (
					t.length % 2 && (t = '0x0' + t.substring(2));
					t.length > 4 && '0x00' === t.substring(0, 4);

				)
					t = '0x' + t.substring(4);
				return t;
			}
			function B(t) {
				return k.from(I(t));
			}
			function O(t) {
				const r = k.from(t).toHexString();
				return '-' === r[0] ? new S('-' + r.substring(3), 16) : new S(r.substring(2), 16);
			}
			function C(t, r, i) {
				const e = { fault: t, operation: r };
				return null != i && (e.value = i), N.throwError(t, d.errors.NUMERIC_FAULT, e);
			}
			const L = new d('properties/5.7.0');
			function j(t, r, i) {
				Object.defineProperty(t, r, { enumerable: !0, value: i, writable: !1 });
			}
			function P(t, r) {
				for (let i = 0; i < 32; i++) {
					if (t[r]) return t[r];
					if (!t.prototype || 'object' != typeof t.prototype) break;
					t = Object.getPrototypeOf(t.prototype).constructor;
				}
				return null;
			}
			const U = { bigint: !0, boolean: !0, function: !0, number: !0, string: !0 };
			function F(t) {
				if (
					(function t(r) {
						if (null == r || U[typeof r]) return !0;
						if (Array.isArray(r) || 'object' == typeof r) {
							if (!Object.isFrozen(r)) return !1;
							const i = Object.keys(r);
							for (let e = 0; e < i.length; e++) {
								let n = null;
								try {
									n = r[i[e]];
								} catch (t) {
									continue;
								}
								if (!t(n)) return !1;
							}
							return !0;
						}
						return L.throwArgumentError('Cannot deepCopy ' + typeof r, 'object', r);
					})(t)
				)
					return t;
				if (Array.isArray(t)) return Object.freeze(t.map((t) => D(t)));
				if ('object' == typeof t) {
					const r = {};
					for (const i in t) {
						const e = t[i];
						void 0 !== e && j(r, i, D(e));
					}
					return r;
				}
				return L.throwArgumentError('Cannot deepCopy ' + typeof t, 'object', t);
			}
			function D(t) {
				return F(t);
			}
			class Z {
				constructor(t) {
					for (const r in t) this[r] = D(t[r]);
				}
			}
			const z = new d('abi/5.0.7'),
				q = {};
			let H = { calldata: !0, memory: !0, storage: !0 },
				W = { calldata: !0, memory: !0 };
			function G(t, r) {
				if ('bytes' === t || 'string' === t) {
					if (H[r]) return !0;
				} else if ('address' === t) {
					if ('payable' === r) return !0;
				} else if ((t.indexOf('[') >= 0 || 'tuple' === t) && W[r]) return !0;
				return (H[r] || 'payable' === r) && z.throwArgumentError('invalid modifier', 'name', r), !1;
			}
			function Y(t, r) {
				for (let i in r) j(t, i, r[i]);
			}
			const $ = Object.freeze({
					sighash: 'sighash',
					minimal: 'minimal',
					full: 'full',
					json: 'json',
				}),
				V = new RegExp(/^(.*)\[([0-9]*)\]$/);
			class J {
				constructor(t, r) {
					t !== q &&
						z.throwError('use fromString', d.errors.UNSUPPORTED_OPERATION, {
							operation: 'new ParamType()',
						}),
						Y(this, r);
					let i = this.type.match(V);
					Y(
						this,
						i
							? {
									arrayLength: parseInt(i[2] || '-1'),
									arrayChildren: J.fromObject({ type: i[1], components: this.components }),
									baseType: 'array',
							  }
							: {
									arrayLength: null,
									arrayChildren: null,
									baseType: null != this.components ? 'tuple' : this.type,
							  }
					),
						(this._isParamType = !0),
						Object.freeze(this);
				}
				format(t) {
					if (
						(t || (t = $.sighash),
						$[t] || z.throwArgumentError('invalid format type', 'format', t),
						t === $.json)
					) {
						let r = {
							type: 'tuple' === this.baseType ? 'tuple' : this.type,
							name: this.name || void 0,
						};
						return (
							'boolean' == typeof this.indexed && (r.indexed = this.indexed),
							this.components &&
								(r.components = this.components.map((r) => JSON.parse(r.format(t)))),
							JSON.stringify(r)
						);
					}
					let r = '';
					return (
						'array' === this.baseType
							? ((r += this.arrayChildren.format(t)),
							  (r += '[' + (this.arrayLength < 0 ? '' : String(this.arrayLength)) + ']'))
							: 'tuple' === this.baseType
							? (t !== $.sighash && (r += this.type),
							  (r +=
									'(' +
									this.components.map((r) => r.format(t)).join(t === $.full ? ', ' : ',') +
									')'))
							: (r += this.type),
						t !== $.sighash &&
							(!0 === this.indexed && (r += ' indexed'),
							t === $.full && this.name && (r += ' ' + this.name)),
						r
					);
				}
				static from(t, r) {
					return 'string' == typeof t ? J.fromString(t, r) : J.fromObject(t);
				}
				static fromObject(t) {
					return J.isParamType(t)
						? t
						: new J(q, {
								name: t.name || null,
								type: ot(t.type),
								indexed: null == t.indexed ? null : !!t.indexed,
								components: t.components ? t.components.map(J.fromObject) : null,
						  });
				}
				static fromString(t, r) {
					return (function (t) {
						return J.fromObject({
							name: t.name,
							type: t.type,
							indexed: t.indexed,
							components: t.components,
						});
					})(
						(function (t, r) {
							let i = t;
							function e(r) {
								z.throwArgumentError('unexpected character at position ' + r, 'param', t);
							}
							function n(t) {
								let i = { type: '', name: '', parent: t, state: { allowType: !0 } };
								return r && (i.indexed = !1), i;
							}
							t = t.replace(/\s/g, ' ');
							let o = { type: '', name: '', state: { allowType: !0 } },
								s = o;
							for (let i = 0; i < t.length; i++) {
								let o = t[i];
								switch (o) {
									case '(':
										s.state.allowType && '' === s.type
											? (s.type = 'tuple')
											: s.state.allowParams || e(i),
											(s.state.allowType = !1),
											(s.type = ot(s.type)),
											(s.components = [n(s)]),
											(s = s.components[0]);
										break;
									case ')':
										delete s.state,
											'indexed' === s.name && (r || e(i), (s.indexed = !0), (s.name = '')),
											G(s.type, s.name) && (s.name = ''),
											(s.type = ot(s.type));
										let t = s;
										(s = s.parent),
											s || e(i),
											delete t.parent,
											(s.state.allowParams = !1),
											(s.state.allowName = !0),
											(s.state.allowArray = !0);
										break;
									case ',':
										delete s.state,
											'indexed' === s.name && (r || e(i), (s.indexed = !0), (s.name = '')),
											G(s.type, s.name) && (s.name = ''),
											(s.type = ot(s.type));
										let h = n(s.parent);
										s.parent.components.push(h), delete s.parent, (s = h);
										break;
									case ' ':
										s.state.allowType &&
											'' !== s.type &&
											((s.type = ot(s.type)),
											delete s.state.allowType,
											(s.state.allowName = !0),
											(s.state.allowParams = !0)),
											s.state.allowName &&
												'' !== s.name &&
												('indexed' === s.name
													? (r || e(i), s.indexed && e(i), (s.indexed = !0), (s.name = ''))
													: G(s.type, s.name)
													? (s.name = '')
													: (s.state.allowName = !1));
										break;
									case '[':
										s.state.allowArray || e(i),
											(s.type += o),
											(s.state.allowArray = !1),
											(s.state.allowName = !1),
											(s.state.readArray = !0);
										break;
									case ']':
										s.state.readArray || e(i),
											(s.type += o),
											(s.state.readArray = !1),
											(s.state.allowArray = !0),
											(s.state.allowName = !0);
										break;
									default:
										s.state.allowType
											? ((s.type += o), (s.state.allowParams = !0), (s.state.allowArray = !0))
											: s.state.allowName
											? ((s.name += o), delete s.state.allowArray)
											: s.state.readArray
											? (s.type += o)
											: e(i);
								}
							}
							return (
								s.parent && z.throwArgumentError('unexpected eof', 'param', t),
								delete o.state,
								'indexed' === s.name
									? (r || e(i.length - 7),
									  s.indexed && e(i.length - 7),
									  (s.indexed = !0),
									  (s.name = ''))
									: G(s.type, s.name) && (s.name = ''),
								(o.type = ot(o.type)),
								o
							);
						})(t, !!r)
					);
				}
				static isParamType(t) {
					return !(null == t || !t._isParamType);
				}
			}
			function K(t, r) {
				return (function (t) {
					t = t.trim();
					let r = [],
						i = '',
						e = 0;
					for (let n = 0; n < t.length; n++) {
						let o = t[n];
						',' === o && 0 === e
							? (r.push(i), (i = ''))
							: ((i += o),
							  '(' === o
									? e++
									: ')' === o &&
									  (e--, -1 === e && z.throwArgumentError('unbalanced parenthesis', 'value', t)));
					}
					i && r.push(i);
					return r;
				})(t).map((t) => J.fromString(t, r));
			}
			class X {
				constructor(t, r) {
					t !== q &&
						z.throwError('use a static from method', d.errors.UNSUPPORTED_OPERATION, {
							operation: 'new Fragment()',
						}),
						Y(this, r),
						(this._isFragment = !0),
						Object.freeze(this);
				}
				static from(t) {
					return X.isFragment(t) ? t : 'string' == typeof t ? X.fromString(t) : X.fromObject(t);
				}
				static fromObject(t) {
					if (X.isFragment(t)) return t;
					switch (t.type) {
						case 'function':
							return nt.fromObject(t);
						case 'event':
							return Q.fromObject(t);
						case 'constructor':
							return et.fromObject(t);
						case 'fallback':
						case 'receive':
							return null;
					}
					return z.throwArgumentError('invalid fragment object', 'value', t);
				}
				static fromString(t) {
					return 'event' ===
						(t = (t = (t = t.replace(/\s/g, ' '))
							.replace(/\(/g, ' (')
							.replace(/\)/g, ') ')
							.replace(/\s+/g, ' ')).trim()).split(' ')[0]
						? Q.fromString(t.substring(5).trim())
						: 'function' === t.split(' ')[0]
						? nt.fromString(t.substring(8).trim())
						: 'constructor' === t.split('(')[0].trim()
						? et.fromString(t.trim())
						: z.throwArgumentError('unsupported fragment', 'value', t);
				}
				static isFragment(t) {
					return !(!t || !t._isFragment);
				}
			}
			class Q extends X {
				format(t) {
					if (
						(t || (t = $.sighash),
						$[t] || z.throwArgumentError('invalid format type', 'format', t),
						t === $.json)
					)
						return JSON.stringify({
							type: 'event',
							anonymous: this.anonymous,
							name: this.name,
							inputs: this.inputs.map((r) => JSON.parse(r.format(t))),
						});
					let r = '';
					return (
						t !== $.sighash && (r += 'event '),
						(r +=
							this.name +
							'(' +
							this.inputs.map((r) => r.format(t)).join(t === $.full ? ', ' : ',') +
							') '),
						t !== $.sighash && this.anonymous && (r += 'anonymous '),
						r.trim()
					);
				}
				static from(t) {
					return 'string' == typeof t ? Q.fromString(t) : Q.fromObject(t);
				}
				static fromObject(t) {
					if (Q.isEventFragment(t)) return t;
					'event' !== t.type && z.throwArgumentError('invalid event object', 'value', t);
					const r = {
						name: ht(t.name),
						anonymous: t.anonymous,
						inputs: t.inputs ? t.inputs.map(J.fromObject) : [],
						type: 'event',
					};
					return new Q(q, r);
				}
				static fromString(t) {
					let r = t.match(ut);
					r || z.throwArgumentError('invalid event string', 'value', t);
					let i = !1;
					return (
						r[3].split(' ').forEach((t) => {
							switch (t.trim()) {
								case 'anonymous':
									i = !0;
									break;
								case '':
									break;
								default:
									z.warn('unknown modifier: ' + t);
							}
						}),
						Q.fromObject({ name: r[1].trim(), anonymous: i, inputs: K(r[2], !0), type: 'event' })
					);
				}
				static isEventFragment(t) {
					return t && t._isFragment && 'event' === t.type;
				}
			}
			function tt(t, r) {
				r.gas = null;
				let i = t.split('@');
				return 1 !== i.length
					? (i.length > 2 &&
							z.throwArgumentError('invalid human-readable ABI signature', 'value', t),
					  i[1].match(/^[0-9]+$/) ||
							z.throwArgumentError('invalid human-readable ABI signature gas', 'value', t),
					  (r.gas = k.from(i[1])),
					  i[0])
					: t;
			}
			function rt(t, r) {
				(r.constant = !1),
					(r.payable = !1),
					(r.stateMutability = 'nonpayable'),
					t.split(' ').forEach((t) => {
						switch (t.trim()) {
							case 'constant':
								r.constant = !0;
								break;
							case 'payable':
								(r.payable = !0), (r.stateMutability = 'payable');
								break;
							case 'nonpayable':
								(r.payable = !1), (r.stateMutability = 'nonpayable');
								break;
							case 'pure':
								(r.constant = !0), (r.stateMutability = 'pure');
								break;
							case 'view':
								(r.constant = !0), (r.stateMutability = 'view');
								break;
							case 'external':
							case 'public':
							case '':
								break;
							default:
								console.log('unknown modifier: ' + t);
						}
					});
			}
			function it(t) {
				let r = { constant: !1, payable: !0, stateMutability: 'payable' };
				return (
					null != t.stateMutability
						? ((r.stateMutability = t.stateMutability),
						  (r.constant = 'view' === r.stateMutability || 'pure' === r.stateMutability),
						  null != t.constant &&
								!!t.constant !== r.constant &&
								z.throwArgumentError(
									'cannot have constant function with mutability ' + r.stateMutability,
									'value',
									t
								),
						  (r.payable = 'payable' === r.stateMutability),
						  null != t.payable &&
								!!t.payable !== r.payable &&
								z.throwArgumentError(
									'cannot have payable function with mutability ' + r.stateMutability,
									'value',
									t
								))
						: null != t.payable
						? ((r.payable = !!t.payable),
						  null != t.constant ||
								r.payable ||
								'constructor' === t.type ||
								z.throwArgumentError('unable to determine stateMutability', 'value', t),
						  (r.constant = !!t.constant),
						  r.constant
								? (r.stateMutability = 'view')
								: (r.stateMutability = r.payable ? 'payable' : 'nonpayable'),
						  r.payable &&
								r.constant &&
								z.throwArgumentError('cannot have constant payable function', 'value', t))
						: null != t.constant
						? ((r.constant = !!t.constant),
						  (r.payable = !r.constant),
						  (r.stateMutability = r.constant ? 'view' : 'payable'))
						: 'constructor' !== t.type &&
						  z.throwArgumentError('unable to determine stateMutability', 'value', t),
					r
				);
			}
			class et extends X {
				format(t) {
					if (
						(t || (t = $.sighash),
						$[t] || z.throwArgumentError('invalid format type', 'format', t),
						t === $.json)
					)
						return JSON.stringify({
							type: 'constructor',
							stateMutability:
								'nonpayable' !== this.stateMutability ? this.stateMutability : void 0,
							payble: this.payable,
							gas: this.gas ? this.gas.toNumber() : void 0,
							inputs: this.inputs.map((r) => JSON.parse(r.format(t))),
						});
					t === $.sighash &&
						z.throwError(
							'cannot format a constructor for sighash',
							d.errors.UNSUPPORTED_OPERATION,
							{ operation: 'format(sighash)' }
						);
					let r =
						'constructor(' +
						this.inputs.map((r) => r.format(t)).join(t === $.full ? ', ' : ',') +
						') ';
					return (
						this.stateMutability &&
							'nonpayable' !== this.stateMutability &&
							(r += this.stateMutability + ' '),
						r.trim()
					);
				}
				static from(t) {
					return 'string' == typeof t ? et.fromString(t) : et.fromObject(t);
				}
				static fromObject(t) {
					if (et.isConstructorFragment(t)) return t;
					'constructor' !== t.type &&
						z.throwArgumentError('invalid constructor object', 'value', t);
					let r = it(t);
					r.constant && z.throwArgumentError('constructor cannot be constant', 'value', t);
					const i = {
						name: null,
						type: t.type,
						inputs: t.inputs ? t.inputs.map(J.fromObject) : [],
						payable: r.payable,
						stateMutability: r.stateMutability,
						gas: t.gas ? k.from(t.gas) : null,
					};
					return new et(q, i);
				}
				static fromString(t) {
					let r = { type: 'constructor' },
						i = (t = tt(t, r)).match(ut);
					return (
						(i && 'constructor' === i[1].trim()) ||
							z.throwArgumentError('invalid constructor string', 'value', t),
						(r.inputs = K(i[2].trim(), !1)),
						rt(i[3].trim(), r),
						et.fromObject(r)
					);
				}
				static isConstructorFragment(t) {
					return t && t._isFragment && 'constructor' === t.type;
				}
			}
			class nt extends et {
				format(t) {
					if (
						(t || (t = $.sighash),
						$[t] || z.throwArgumentError('invalid format type', 'format', t),
						t === $.json)
					)
						return JSON.stringify({
							type: 'function',
							name: this.name,
							constant: this.constant,
							stateMutability:
								'nonpayable' !== this.stateMutability ? this.stateMutability : void 0,
							payble: this.payable,
							gas: this.gas ? this.gas.toNumber() : void 0,
							inputs: this.inputs.map((r) => JSON.parse(r.format(t))),
							ouputs: this.outputs.map((r) => JSON.parse(r.format(t))),
						});
					let r = '';
					return (
						t !== $.sighash && (r += 'function '),
						(r +=
							this.name +
							'(' +
							this.inputs.map((r) => r.format(t)).join(t === $.full ? ', ' : ',') +
							') '),
						t !== $.sighash &&
							(this.stateMutability
								? 'nonpayable' !== this.stateMutability && (r += this.stateMutability + ' ')
								: this.constant && (r += 'view '),
							this.outputs &&
								this.outputs.length &&
								(r += 'returns (' + this.outputs.map((r) => r.format(t)).join(', ') + ') '),
							null != this.gas && (r += '@' + this.gas.toString() + ' ')),
						r.trim()
					);
				}
				static from(t) {
					return 'string' == typeof t ? nt.fromString(t) : nt.fromObject(t);
				}
				static fromObject(t) {
					if (nt.isFunctionFragment(t)) return t;
					'function' !== t.type && z.throwArgumentError('invalid function object', 'value', t);
					let r = it(t);
					const i = {
						type: t.type,
						name: ht(t.name),
						constant: r.constant,
						inputs: t.inputs ? t.inputs.map(J.fromObject) : [],
						outputs: t.outputs ? t.outputs.map(J.fromObject) : [],
						payable: r.payable,
						stateMutability: r.stateMutability,
						gas: t.gas ? k.from(t.gas) : null,
					};
					return new nt(q, i);
				}
				static fromString(t) {
					let r = { type: 'function' },
						i = (t = tt(t, r)).split(' returns ');
					i.length > 2 && z.throwArgumentError('invalid function string', 'value', t);
					let e = i[0].match(ut);
					if (
						(e || z.throwArgumentError('invalid function signature', 'value', t),
						(r.name = e[1].trim()),
						r.name && ht(r.name),
						(r.inputs = K(e[2], !1)),
						rt(e[3].trim(), r),
						i.length > 1)
					) {
						let e = i[1].match(ut);
						('' == e[1].trim() && '' == e[3].trim()) ||
							z.throwArgumentError('unexpected tokens', 'value', t),
							(r.outputs = K(e[2], !1));
					} else r.outputs = [];
					return nt.fromObject(r);
				}
				static isFunctionFragment(t) {
					return t && t._isFragment && 'function' === t.type;
				}
			}
			function ot(t) {
				return (
					t.match(/^uint($|[^1-9])/)
						? (t = 'uint256' + t.substring(4))
						: t.match(/^int($|[^1-9])/) && (t = 'int256' + t.substring(3)),
					t
				);
			}
			const st = new RegExp('^[A-Za-z_][A-Za-z0-9_]*$');
			function ht(t) {
				return (
					(t && t.match(st)) || z.throwArgumentError(`invalid identifier "${t}"`, 'value', t), t
				);
			}
			const ut = new RegExp('^([^)(]*)\\((.*)\\)([^)(]*)$');
			const at = new d('abi/5.0.7');
			function lt(t) {
				const r = [],
					i = function (t, e) {
						if (Array.isArray(e))
							for (let n in e) {
								const o = t.slice();
								o.push(n);
								try {
									i(o, e[n]);
								} catch (t) {
									r.push({ path: o, error: t });
								}
							}
					};
				return i([], t), r;
			}
			class ft {
				constructor(t, r, i, e) {
					(this.name = t), (this.type = r), (this.localName = i), (this.dynamic = e);
				}
				_throwError(t, r) {
					at.throwArgumentError(t, this.localName, r);
				}
			}
			class mt {
				constructor(t) {
					j(this, 'wordSize', t || 32),
						(this._data = []),
						(this._dataLength = 0),
						(this._padding = new Uint8Array(t));
				}
				get data() {
					return (function (t) {
						let r = '0x';
						return (
							t.forEach((t) => {
								r += A(t).substring(2);
							}),
							r
						);
					})(this._data);
				}
				get length() {
					return this._dataLength;
				}
				_writeData(t) {
					return this._data.push(t), (this._dataLength += t.length), t.length;
				}
				appendWriter(t) {
					return this._writeData(b(t._data));
				}
				writeBytes(t) {
					let r = M(t);
					const i = r.length % this.wordSize;
					return i && (r = b([r, this._padding.slice(i)])), this._writeData(r);
				}
				_getValue(t) {
					let r = M(k.from(t));
					return (
						r.length > this.wordSize &&
							at.throwError('value out-of-bounds', d.errors.BUFFER_OVERRUN, {
								length: this.wordSize,
								offset: r.length,
							}),
						r.length % this.wordSize && (r = b([this._padding.slice(r.length % this.wordSize), r])),
						r
					);
				}
				writeValue(t) {
					return this._writeData(this._getValue(t));
				}
				writeUpdatableValue() {
					const t = this._data.length;
					return (
						this._data.push(this._padding),
						(this._dataLength += this.wordSize),
						(r) => {
							this._data[t] = this._getValue(r);
						}
					);
				}
			}
			class ct {
				constructor(t, r, i, e) {
					j(this, '_data', M(t)),
						j(this, 'wordSize', r || 32),
						j(this, '_coerceFunc', i),
						j(this, 'allowLoose', e),
						(this._offset = 0);
				}
				get data() {
					return A(this._data);
				}
				get consumed() {
					return this._offset;
				}
				static coerce(t, r) {
					let i = t.match('^u?int([0-9]+)$');
					return i && parseInt(i[1]) <= 48 && (r = r.toNumber()), r;
				}
				coerce(t, r) {
					return this._coerceFunc ? this._coerceFunc(t, r) : ct.coerce(t, r);
				}
				_peekBytes(t, r, i) {
					let e = Math.ceil(r / this.wordSize) * this.wordSize;
					return (
						this._offset + e > this._data.length &&
							(this.allowLoose && i && this._offset + r <= this._data.length
								? (e = r)
								: at.throwError('data out-of-bounds', d.errors.BUFFER_OVERRUN, {
										length: this._data.length,
										offset: this._offset + e,
								  })),
						this._data.slice(this._offset, this._offset + e)
					);
				}
				subReader(t) {
					return new ct(
						this._data.slice(this._offset + t),
						this.wordSize,
						this._coerceFunc,
						this.allowLoose
					);
				}
				readBytes(t, r) {
					let i = this._peekBytes(0, t, !!r);
					return (this._offset += i.length), i.slice(0, t);
				}
				readValue() {
					return k.from(this.readBytes(this.wordSize));
				}
			}
			var dt = i(7),
				pt = i.n(dt);
			function gt(t) {
				return '0x' + pt.a.keccak_256(M(t));
			}
			new d('rlp/5.7.0');
			const vt = new d('address/5.7.0');
			function yt(t) {
				_(t, 20) || vt.throwArgumentError('invalid address', 'address', t);
				const r = (t = t.toLowerCase()).substring(2).split(''),
					i = new Uint8Array(40);
				for (let t = 0; t < 40; t++) i[t] = r[t].charCodeAt(0);
				const e = M(gt(i));
				for (let t = 0; t < 40; t += 2)
					e[t >> 1] >> 4 >= 8 && (r[t] = r[t].toUpperCase()),
						(15 & e[t >> 1]) >= 8 && (r[t + 1] = r[t + 1].toUpperCase());
				return '0x' + r.join('');
			}
			const wt = {};
			for (let t = 0; t < 10; t++) wt[String(t)] = String(t);
			for (let t = 0; t < 26; t++) wt[String.fromCharCode(65 + t)] = String(10 + t);
			const Mt = Math.floor(
				((bt = 9007199254740991), Math.log10 ? Math.log10(bt) : Math.log(bt) / Math.LN10)
			);
			var bt;
			function _t(t) {
				let r = (t = (t = t.toUpperCase()).substring(4) + t.substring(0, 2) + '00')
					.split('')
					.map((t) => wt[t])
					.join('');
				for (; r.length >= Mt; ) {
					let t = r.substring(0, Mt);
					r = (parseInt(t, 10) % 97) + r.substring(t.length);
				}
				let i = String(98 - (parseInt(r, 10) % 97));
				for (; i.length < 2; ) i = '0' + i;
				return i;
			}
			function At(t) {
				let r = null;
				if (
					('string' != typeof t && vt.throwArgumentError('invalid address', 'address', t),
					t.match(/^(0x)?[0-9a-fA-F]{40}$/))
				)
					'0x' !== t.substring(0, 2) && (t = '0x' + t),
						(r = yt(t)),
						t.match(/([A-F].*[a-f])|([a-f].*[A-F])/) &&
							r !== t &&
							vt.throwArgumentError('bad address checksum', 'address', t);
				else if (t.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {
					for (
						t.substring(2, 4) !== _t(t) && vt.throwArgumentError('bad icap checksum', 'address', t),
							i = t.substring(4),
							r = new S(i, 36).toString(16);
						r.length < 40;

					)
						r = '0' + r;
					r = yt('0x' + r);
				} else vt.throwArgumentError('invalid address', 'address', t);
				var i;
				return r;
			}
			class Et extends ft {
				constructor(t) {
					super('address', 'address', t, !1);
				}
				encode(t, r) {
					try {
						At(r);
					} catch (t) {
						this._throwError(t.message, r);
					}
					return t.writeValue(r);
				}
				decode(t) {
					return At(x(t.readValue().toHexString(), 20));
				}
			}
			class xt extends ft {
				constructor(t) {
					super(t.name, t.type, void 0, t.dynamic), (this.coder = t);
				}
				encode(t, r) {
					return this.coder.encode(t, r);
				}
				decode(t) {
					return this.coder.decode(t);
				}
			}
			const St = new d('abi/5.0.7');
			function Nt(t, r, i) {
				let e = null;
				if (Array.isArray(i)) e = i;
				else if (i && 'object' == typeof i) {
					let t = {};
					e = r.map((r) => {
						const e = r.localName;
						return (
							e ||
								St.throwError(
									'cannot encode object for signature with missing names',
									d.errors.INVALID_ARGUMENT,
									{ argument: 'values', coder: r, value: i }
								),
							t[e] &&
								St.throwError(
									'cannot encode object for signature with duplicate names',
									d.errors.INVALID_ARGUMENT,
									{ argument: 'values', coder: r, value: i }
								),
							(t[e] = !0),
							i[e]
						);
					});
				} else St.throwArgumentError('invalid tuple value', 'tuple', i);
				r.length !== e.length && St.throwArgumentError('types/value length mismatch', 'tuple', i);
				let n = new mt(t.wordSize),
					o = new mt(t.wordSize),
					s = [];
				r.forEach((t, r) => {
					let i = e[r];
					if (t.dynamic) {
						let r = o.length;
						t.encode(o, i);
						let e = n.writeUpdatableValue();
						s.push((t) => {
							e(t + r);
						});
					} else t.encode(n, i);
				}),
					s.forEach((t) => {
						t(n.length);
					});
				let h = t.appendWriter(n);
				return (h += t.appendWriter(o)), h;
			}
			function Tt(t, r) {
				let i = [],
					e = t.subReader(0);
				r.forEach((r) => {
					let n = null;
					if (r.dynamic) {
						let i = t.readValue(),
							o = e.subReader(i.toNumber());
						try {
							n = r.decode(o);
						} catch (t) {
							if (t.code === d.errors.BUFFER_OVERRUN) throw t;
							(n = t), (n.baseType = r.name), (n.name = r.localName), (n.type = r.type);
						}
					} else
						try {
							n = r.decode(t);
						} catch (t) {
							if (t.code === d.errors.BUFFER_OVERRUN) throw t;
							(n = t), (n.baseType = r.name), (n.name = r.localName), (n.type = r.type);
						}
					null != n && i.push(n);
				});
				const n = r.reduce((t, r) => {
					const i = r.localName;
					return i && (t[i] || (t[i] = 0), t[i]++), t;
				}, {});
				r.forEach((t, r) => {
					let e = t.localName;
					if (!e || 1 !== n[e]) return;
					if (('length' === e && (e = '_length'), null != i[e])) return;
					const o = i[r];
					o instanceof Error
						? Object.defineProperty(i, e, {
								get: () => {
									throw o;
								},
						  })
						: (i[e] = o);
				});
				for (let t = 0; t < i.length; t++) {
					const r = i[t];
					r instanceof Error &&
						Object.defineProperty(i, t, {
							get: () => {
								throw r;
							},
						});
				}
				return Object.freeze(i);
			}
			class Rt extends ft {
				constructor(t, r, i) {
					super('array', t.type + '[' + (r >= 0 ? r : '') + ']', i, -1 === r || t.dynamic),
						(this.coder = t),
						(this.length = r);
				}
				encode(t, r) {
					Array.isArray(r) || this._throwError('expected array value', r);
					let i = this.length;
					-1 === i && ((i = r.length), t.writeValue(r.length)),
						St.checkArgumentCount(
							r.length,
							i,
							'coder array' + (this.localName ? ' ' + this.localName : '')
						);
					let e = [];
					for (let t = 0; t < r.length; t++) e.push(this.coder);
					return Nt(t, e, r);
				}
				decode(t) {
					let r = this.length;
					-1 === r && (r = t.readValue().toNumber());
					let i = [];
					for (let t = 0; t < r; t++) i.push(new xt(this.coder));
					return t.coerce(this.name, Tt(t, i));
				}
			}
			class kt extends ft {
				constructor(t) {
					super('bool', 'bool', t, !1);
				}
				encode(t, r) {
					return t.writeValue(r ? 1 : 0);
				}
				decode(t) {
					return t.coerce(this.type, !t.readValue().isZero());
				}
			}
			class It extends ft {
				constructor(t, r) {
					super(t, t, r, !0);
				}
				encode(t, r) {
					r = M(r);
					let i = t.writeValue(r.length);
					return (i += t.writeBytes(r)), i;
				}
				decode(t) {
					return t.readBytes(t.readValue().toNumber(), !0);
				}
			}
			class Bt extends It {
				constructor(t) {
					super('bytes', t);
				}
				decode(t) {
					return t.coerce(this.name, A(super.decode(t)));
				}
			}
			class Ot extends ft {
				constructor(t, r) {
					let i = 'bytes' + String(t);
					super(i, i, r, !1), (this.size = t);
				}
				encode(t, r) {
					let i = M(r);
					return (
						i.length !== this.size && this._throwError('incorrect data length', r), t.writeBytes(i)
					);
				}
				decode(t) {
					return t.coerce(this.name, A(t.readBytes(this.size)));
				}
			}
			class Ct extends ft {
				constructor(t) {
					super('null', '', t, !1);
				}
				encode(t, r) {
					return null != r && this._throwError('not null', r), t.writeBytes([]);
				}
				decode(t) {
					return t.readBytes(0), t.coerce(this.name, null);
				}
			}
			const Lt = k.from(-1),
				jt = k.from(0),
				Pt = k.from(1),
				Ut = k.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
			class Ft extends ft {
				constructor(t, r, i) {
					const e = (r ? 'int' : 'uint') + 8 * t;
					super(e, e, i, !1), (this.size = t), (this.signed = r);
				}
				encode(t, r) {
					let i = k.from(r),
						e = Ut.mask(8 * t.wordSize);
					if (this.signed) {
						let t = e.mask(8 * this.size - 1);
						(i.gt(t) || i.lt(t.add(Pt).mul(Lt))) && this._throwError('value out-of-bounds', r);
					} else
						(i.lt(jt) || i.gt(e.mask(8 * this.size))) && this._throwError('value out-of-bounds', r);
					return (
						(i = i.toTwos(8 * this.size).mask(8 * this.size)),
						this.signed && (i = i.fromTwos(8 * this.size).toTwos(8 * t.wordSize)),
						t.writeValue(i)
					);
				}
				decode(t) {
					let r = t.readValue().mask(8 * this.size);
					return this.signed && (r = r.fromTwos(8 * this.size)), t.coerce(this.name, r);
				}
			}
			const Dt = new d('strings/5.7.0');
			var Zt, zt;
			function qt(t, r, i, e, n) {
				if (t === zt.BAD_PREFIX || t === zt.UNEXPECTED_CONTINUE) {
					let t = 0;
					for (let e = r + 1; e < i.length && i[e] >> 6 == 2; e++) t++;
					return t;
				}
				return t === zt.OVERRUN ? i.length - r - 1 : 0;
			}
			!(function (t) {
				(t.current = ''), (t.NFC = 'NFC'), (t.NFD = 'NFD'), (t.NFKC = 'NFKC'), (t.NFKD = 'NFKD');
			})(Zt || (Zt = {})),
				(function (t) {
					(t.UNEXPECTED_CONTINUE = 'unexpected continuation byte'),
						(t.BAD_PREFIX = 'bad codepoint prefix'),
						(t.OVERRUN = 'string overrun'),
						(t.MISSING_CONTINUE = 'missing continuation byte'),
						(t.OUT_OF_RANGE = 'out of UTF-8 range'),
						(t.UTF16_SURROGATE = 'UTF-16 surrogate'),
						(t.OVERLONG = 'overlong representation');
				})(zt || (zt = {}));
			const Ht = Object.freeze({
				error: function (t, r, i, e, n) {
					return Dt.throwArgumentError(`invalid codepoint at offset ${r}; ${t}`, 'bytes', i);
				},
				ignore: qt,
				replace: function (t, r, i, e, n) {
					return t === zt.OVERLONG ? (e.push(n), 0) : (e.push(65533), qt(t, r, i));
				},
			});
			function Wt(t, r) {
				null == r && (r = Ht.error), (t = M(t));
				const i = [];
				let e = 0;
				for (; e < t.length; ) {
					const n = t[e++];
					if (n >> 7 == 0) {
						i.push(n);
						continue;
					}
					let o = null,
						s = null;
					if (192 == (224 & n)) (o = 1), (s = 127);
					else if (224 == (240 & n)) (o = 2), (s = 2047);
					else {
						if (240 != (248 & n)) {
							e += r(128 == (192 & n) ? zt.UNEXPECTED_CONTINUE : zt.BAD_PREFIX, e - 1, t, i);
							continue;
						}
						(o = 3), (s = 65535);
					}
					if (e - 1 + o >= t.length) {
						e += r(zt.OVERRUN, e - 1, t, i);
						continue;
					}
					let h = n & ((1 << (8 - o - 1)) - 1);
					for (let n = 0; n < o; n++) {
						let n = t[e];
						if (128 != (192 & n)) {
							(e += r(zt.MISSING_CONTINUE, e, t, i)), (h = null);
							break;
						}
						(h = (h << 6) | (63 & n)), e++;
					}
					null !== h &&
						(h > 1114111
							? (e += r(zt.OUT_OF_RANGE, e - 1 - o, t, i, h))
							: h >= 55296 && h <= 57343
							? (e += r(zt.UTF16_SURROGATE, e - 1 - o, t, i, h))
							: h <= s
							? (e += r(zt.OVERLONG, e - 1 - o, t, i, h))
							: i.push(h));
				}
				return i;
			}
			function Gt(t, r = Zt.current) {
				r != Zt.current && (Dt.checkNormalize(), (t = t.normalize(r)));
				let i = [];
				for (let r = 0; r < t.length; r++) {
					const e = t.charCodeAt(r);
					if (e < 128) i.push(e);
					else if (e < 2048) i.push((e >> 6) | 192), i.push((63 & e) | 128);
					else if (55296 == (64512 & e)) {
						r++;
						const n = t.charCodeAt(r);
						if (r >= t.length || 56320 != (64512 & n)) throw new Error('invalid utf-8 string');
						const o = 65536 + ((1023 & e) << 10) + (1023 & n);
						i.push((o >> 18) | 240),
							i.push(((o >> 12) & 63) | 128),
							i.push(((o >> 6) & 63) | 128),
							i.push((63 & o) | 128);
					} else i.push((e >> 12) | 224), i.push(((e >> 6) & 63) | 128), i.push((63 & e) | 128);
				}
				return M(i);
			}
			function Yt(t, r) {
				return Wt(t, r)
					.map((t) =>
						t <= 65535
							? String.fromCharCode(t)
							: ((t -= 65536), String.fromCharCode(55296 + ((t >> 10) & 1023), 56320 + (1023 & t)))
					)
					.join('');
			}
			class $t extends It {
				constructor(t) {
					super('string', t);
				}
				encode(t, r) {
					return super.encode(t, Gt(r));
				}
				decode(t) {
					return Yt(super.decode(t));
				}
			}
			class Vt extends ft {
				constructor(t, r) {
					let i = !1;
					const e = [];
					t.forEach((t) => {
						t.dynamic && (i = !0), e.push(t.type);
					});
					super('tuple', 'tuple(' + e.join(',') + ')', r, i), (this.coders = t);
				}
				encode(t, r) {
					return Nt(t, this.coders, r);
				}
				decode(t) {
					return t.coerce(this.name, Tt(t, this.coders));
				}
			}
			const Jt = new d('abi/5.0.7'),
				Kt = new RegExp(/^bytes([0-9]*)$/),
				Xt = new RegExp(/^(u?int)([0-9]*)$/);
			class Qt {
				constructor(t) {
					Jt.checkNew(new.target, Qt), j(this, 'coerceFunc', t || null);
				}
				_getCoder(t) {
					switch (t.baseType) {
						case 'address':
							return new Et(t.name);
						case 'bool':
							return new kt(t.name);
						case 'string':
							return new $t(t.name);
						case 'bytes':
							return new Bt(t.name);
						case 'array':
							return new Rt(this._getCoder(t.arrayChildren), t.arrayLength, t.name);
						case 'tuple':
							return new Vt(
								(t.components || []).map((t) => this._getCoder(t)),
								t.name
							);
						case '':
							return new Ct(t.name);
					}
					let r = t.type.match(Xt);
					if (r) {
						let i = parseInt(r[2] || '256');
						return (
							(0 === i || i > 256 || i % 8 != 0) &&
								Jt.throwArgumentError('invalid ' + r[1] + ' bit length', 'param', t),
							new Ft(i / 8, 'int' === r[1], t.name)
						);
					}
					if (((r = t.type.match(Kt)), r)) {
						let i = parseInt(r[1]);
						return (
							(0 === i || i > 32) && Jt.throwArgumentError('invalid bytes length', 'param', t),
							new Ot(i, t.name)
						);
					}
					return Jt.throwArgumentError('invalid type', 'type', t.type);
				}
				_getWordSize() {
					return 32;
				}
				_getReader(t, r) {
					return new ct(t, this._getWordSize(), this.coerceFunc, r);
				}
				_getWriter() {
					return new mt(this._getWordSize());
				}
				encode(t, r) {
					t.length !== r.length &&
						Jt.throwError('types/values length mismatch', d.errors.INVALID_ARGUMENT, {
							count: { types: t.length, values: r.length },
							value: { types: t, values: r },
						});
					const i = t.map((t) => this._getCoder(J.from(t))),
						e = new Vt(i, '_'),
						n = this._getWriter();
					return e.encode(n, r), n.data;
				}
				decode(t, r, i) {
					const e = t.map((t) => this._getCoder(J.from(t)));
					return new Vt(e, '_').decode(this._getReader(M(r), i));
				}
			}
			const tr = new Qt();
			function rr(t) {
				return gt(Gt(t));
			}
			const ir = new d('abi/5.0.7');
			class er extends Z {}
			class nr extends Z {}
			class or extends Z {
				static isIndexed(t) {
					return !(!t || !t._isIndexed);
				}
			}
			function sr(t, r) {
				const i = new Error('deferred error during ABI decoding triggered accessing ' + t);
				return (i.error = r), i;
			}
			class hr {
				constructor(t) {
					ir.checkNew(new.target, hr);
					let r = [];
					(r = 'string' == typeof t ? JSON.parse(t) : t),
						j(
							this,
							'fragments',
							r.map((t) => X.from(t)).filter((t) => null != t)
						),
						j(this, '_abiCoder', P(new.target, 'getAbiCoder')()),
						j(this, 'functions', {}),
						j(this, 'errors', {}),
						j(this, 'events', {}),
						j(this, 'structs', {}),
						this.fragments.forEach((t) => {
							let r = null;
							switch (t.type) {
								case 'constructor':
									return this.deploy
										? void ir.warn('duplicate definition - constructor')
										: void j(this, 'deploy', t);
								case 'function':
									r = this.functions;
									break;
								case 'event':
									r = this.events;
									break;
								default:
									return;
							}
							let i = t.format();
							r[i] ? ir.warn('duplicate definition - ' + i) : (r[i] = t);
						}),
						this.deploy || j(this, 'deploy', et.from({ payable: !1, type: 'constructor' })),
						j(this, '_isInterface', !0);
				}
				format(t) {
					t || (t = $.full),
						t === $.sighash &&
							ir.throwArgumentError('interface does not support formatting sighash', 'format', t);
					const r = this.fragments.map((r) => r.format(t));
					return t === $.json ? JSON.stringify(r.map((t) => JSON.parse(t))) : r;
				}
				static getAbiCoder() {
					return tr;
				}
				static getAddress(t) {
					return At(t);
				}
				static getSighash(t) {
					return E(rr(t.format()), 0, 4);
				}
				static getEventTopic(t) {
					return rr(t.format());
				}
				getFunction(t) {
					if (_(t)) {
						for (const r in this.functions) if (t === this.getSighash(r)) return this.functions[r];
						ir.throwArgumentError('no matching function', 'sighash', t);
					}
					if (-1 === t.indexOf('(')) {
						const r = t.trim(),
							i = Object.keys(this.functions).filter((t) => t.split('(')[0] === r);
						return (
							0 === i.length
								? ir.throwArgumentError('no matching function', 'name', r)
								: i.length > 1 && ir.throwArgumentError('multiple matching functions', 'name', r),
							this.functions[i[0]]
						);
					}
					const r = this.functions[nt.fromString(t).format()];
					return r || ir.throwArgumentError('no matching function', 'signature', t), r;
				}
				getEvent(t) {
					if (_(t)) {
						const r = t.toLowerCase();
						for (const t in this.events) if (r === this.getEventTopic(t)) return this.events[t];
						ir.throwArgumentError('no matching event', 'topichash', r);
					}
					if (-1 === t.indexOf('(')) {
						const r = t.trim(),
							i = Object.keys(this.events).filter((t) => t.split('(')[0] === r);
						return (
							0 === i.length
								? ir.throwArgumentError('no matching event', 'name', r)
								: i.length > 1 && ir.throwArgumentError('multiple matching events', 'name', r),
							this.events[i[0]]
						);
					}
					const r = this.events[Q.fromString(t).format()];
					return r || ir.throwArgumentError('no matching event', 'signature', t), r;
				}
				getSighash(t) {
					return (
						'string' == typeof t && (t = this.getFunction(t)), P(this.constructor, 'getSighash')(t)
					);
				}
				getEventTopic(t) {
					return (
						'string' == typeof t && (t = this.getEvent(t)), P(this.constructor, 'getEventTopic')(t)
					);
				}
				_decodeParams(t, r) {
					return this._abiCoder.decode(t, r);
				}
				_encodeParams(t, r) {
					return this._abiCoder.encode(t, r);
				}
				encodeDeploy(t) {
					return this._encodeParams(this.deploy.inputs, t || []);
				}
				decodeFunctionData(t, r) {
					'string' == typeof t && (t = this.getFunction(t));
					const i = M(r);
					return (
						A(i.slice(0, 4)) !== this.getSighash(t) &&
							ir.throwArgumentError(
								`data signature does not match function ${t.name}.`,
								'data',
								A(i)
							),
						this._decodeParams(t.inputs, i.slice(4))
					);
				}
				encodeFunctionData(t, r) {
					return (
						'string' == typeof t && (t = this.getFunction(t)),
						A(b([this.getSighash(t), this._encodeParams(t.inputs, r || [])]))
					);
				}
				decodeFunctionResult(t, r) {
					'string' == typeof t && (t = this.getFunction(t));
					let i = M(r),
						e = null,
						n = null;
					switch (i.length % this._abiCoder._getWordSize()) {
						case 0:
							try {
								return this._abiCoder.decode(t.outputs, i);
							} catch (t) {}
							break;
						case 4:
							'0x08c379a0' === A(i.slice(0, 4)) &&
								((n = 'Error(string)'), (e = this._abiCoder.decode(['string'], i.slice(4))[0]));
					}
					return ir.throwError('call revert exception', d.errors.CALL_EXCEPTION, {
						method: t.format(),
						errorSignature: n,
						errorArgs: [e],
						reason: e,
					});
				}
				encodeFunctionResult(t, r) {
					return (
						'string' == typeof t && (t = this.getFunction(t)),
						A(this._abiCoder.encode(t.outputs, r || []))
					);
				}
				encodeFilterTopics(t, r) {
					'string' == typeof t && (t = this.getEvent(t)),
						r.length > t.inputs.length &&
							ir.throwError('too many arguments for ' + t.format(), d.errors.UNEXPECTED_ARGUMENT, {
								argument: 'values',
								value: r,
							});
					let i = [];
					t.anonymous || i.push(this.getEventTopic(t));
					const e = (t, r) =>
						'string' === t.type
							? rr(r)
							: 'bytes' === t.type
							? gt(A(r))
							: ('address' === t.type && this._abiCoder.encode(['address'], [r]), x(A(r), 32));
					for (
						r.forEach((r, n) => {
							let o = t.inputs[n];
							o.indexed
								? null == r
									? i.push(null)
									: 'array' === o.baseType || 'tuple' === o.baseType
									? ir.throwArgumentError(
											'filtering with tuples or arrays not supported',
											'contract.' + o.name,
											r
									  )
									: Array.isArray(r)
									? i.push(r.map((t) => e(o, t)))
									: i.push(e(o, r))
								: null != r &&
								  ir.throwArgumentError(
										'cannot filter non-indexed parameters; must be null',
										'contract.' + o.name,
										r
								  );
						});
						i.length && null === i[i.length - 1];

					)
						i.pop();
					return i;
				}
				encodeEventLog(t, r) {
					'string' == typeof t && (t = this.getEvent(t));
					const i = [],
						e = [],
						n = [];
					return (
						t.anonymous || i.push(this.getEventTopic(t)),
						r.length !== t.inputs.length &&
							ir.throwArgumentError('event arguments/values mismatch', 'values', r),
						t.inputs.forEach((t, o) => {
							const s = r[o];
							if (t.indexed)
								if ('string' === t.type) i.push(rr(s));
								else if ('bytes' === t.type) i.push(gt(s));
								else {
									if ('tuple' === t.baseType || 'array' === t.baseType)
										throw new Error('not implemented');
									i.push(this._abiCoder.encode([t.type], [s]));
								}
							else e.push(t), n.push(s);
						}),
						{ data: this._abiCoder.encode(e, n), topics: i }
					);
				}
				decodeEventLog(t, r, i) {
					if (('string' == typeof t && (t = this.getEvent(t)), null != i && !t.anonymous)) {
						let r = this.getEventTopic(t);
						(_(i[0], 32) && i[0].toLowerCase() === r) ||
							ir.throwError('fragment/topic mismatch', d.errors.INVALID_ARGUMENT, {
								argument: 'topics[0]',
								expected: r,
								value: i[0],
							}),
							(i = i.slice(1));
					}
					let e = [],
						n = [],
						o = [];
					t.inputs.forEach((t, r) => {
						t.indexed
							? 'string' === t.type ||
							  'bytes' === t.type ||
							  'tuple' === t.baseType ||
							  'array' === t.baseType
								? (e.push(J.fromObject({ type: 'bytes32', name: t.name })), o.push(!0))
								: (e.push(t), o.push(!1))
							: (n.push(t), o.push(!1));
					});
					let s = null != i ? this._abiCoder.decode(e, b(i)) : null,
						h = this._abiCoder.decode(n, r, !0),
						u = [],
						a = 0,
						l = 0;
					t.inputs.forEach((t, r) => {
						if (t.indexed)
							if (null == s) u[r] = new or({ _isIndexed: !0, hash: null });
							else if (o[r]) u[r] = new or({ _isIndexed: !0, hash: s[l++] });
							else
								try {
									u[r] = s[l++];
								} catch (t) {
									u[r] = t;
								}
						else
							try {
								u[r] = h[a++];
							} catch (t) {
								u[r] = t;
							}
						if (t.name && null == u[t.name]) {
							const i = u[r];
							i instanceof Error
								? Object.defineProperty(u, t.name, {
										get: () => {
											throw sr('property ' + JSON.stringify(t.name), i);
										},
								  })
								: (u[t.name] = i);
						}
					});
					for (let t = 0; t < u.length; t++) {
						const r = u[t];
						r instanceof Error &&
							Object.defineProperty(u, t, {
								get: () => {
									throw sr('index ' + t, r);
								},
							});
					}
					return Object.freeze(u);
				}
				parseTransaction(t) {
					let r = this.getFunction(t.data.substring(0, 10).toLowerCase());
					return r
						? new nr({
								args: this._abiCoder.decode(r.inputs, '0x' + t.data.substring(10)),
								functionFragment: r,
								name: r.name,
								signature: r.format(),
								sighash: this.getSighash(r),
								value: k.from(t.value || '0'),
						  })
						: null;
				}
				parseLog(t) {
					let r = this.getEvent(t.topics[0]);
					return !r || r.anonymous
						? null
						: new er({
								eventFragment: r,
								name: r.name,
								signature: r.format(),
								topic: this.getEventTopic(r),
								args: this.decodeEventLog(r, t.data, t.topics),
						  });
				}
				static isInterface(t) {
					return !(!t || !t._isInterface);
				}
			}
		},
		function (t, r, i) {
			(function (t) {
				!(function (t, r) {
					'use strict';
					function e(t, r) {
						if (!t) throw new Error(r || 'Assertion failed');
					}
					function n(t, r) {
						t.super_ = r;
						var i = function () {};
						(i.prototype = r.prototype), (t.prototype = new i()), (t.prototype.constructor = t);
					}
					function o(t, r, i) {
						if (o.isBN(t)) return t;
						(this.negative = 0),
							(this.words = null),
							(this.length = 0),
							(this.red = null),
							null !== t &&
								(('le' !== r && 'be' !== r) || ((i = r), (r = 10)),
								this._init(t || 0, r || 10, i || 'be'));
					}
					var s;
					'object' == typeof t ? (t.exports = o) : (r.BN = o), (o.BN = o), (o.wordSize = 26);
					try {
						s =
							'undefined' != typeof window && void 0 !== window.Buffer
								? window.Buffer
								: i(40).Buffer;
					} catch (t) {}
					function h(t, r) {
						var i = t.charCodeAt(r);
						return i >= 48 && i <= 57
							? i - 48
							: i >= 65 && i <= 70
							? i - 55
							: i >= 97 && i <= 102
							? i - 87
							: void e(!1, 'Invalid character in ' + t);
					}
					function u(t, r, i) {
						var e = h(t, i);
						return i - 1 >= r && (e |= h(t, i - 1) << 4), e;
					}
					function a(t, r, i, n) {
						for (var o = 0, s = 0, h = Math.min(t.length, i), u = r; u < h; u++) {
							var a = t.charCodeAt(u) - 48;
							(o *= n),
								(s = a >= 49 ? a - 49 + 10 : a >= 17 ? a - 17 + 10 : a),
								e(a >= 0 && s < n, 'Invalid character'),
								(o += s);
						}
						return o;
					}
					function l(t, r) {
						(t.words = r.words), (t.length = r.length), (t.negative = r.negative), (t.red = r.red);
					}
					if (
						((o.isBN = function (t) {
							return (
								t instanceof o ||
								(null !== t &&
									'object' == typeof t &&
									t.constructor.wordSize === o.wordSize &&
									Array.isArray(t.words))
							);
						}),
						(o.max = function (t, r) {
							return t.cmp(r) > 0 ? t : r;
						}),
						(o.min = function (t, r) {
							return t.cmp(r) < 0 ? t : r;
						}),
						(o.prototype._init = function (t, r, i) {
							if ('number' == typeof t) return this._initNumber(t, r, i);
							if ('object' == typeof t) return this._initArray(t, r, i);
							'hex' === r && (r = 16), e(r === (0 | r) && r >= 2 && r <= 36);
							var n = 0;
							'-' === (t = t.toString().replace(/\s+/g, ''))[0] && (n++, (this.negative = 1)),
								n < t.length &&
									(16 === r
										? this._parseHex(t, n, i)
										: (this._parseBase(t, r, n),
										  'le' === i && this._initArray(this.toArray(), r, i)));
						}),
						(o.prototype._initNumber = function (t, r, i) {
							t < 0 && ((this.negative = 1), (t = -t)),
								t < 67108864
									? ((this.words = [67108863 & t]), (this.length = 1))
									: t < 4503599627370496
									? ((this.words = [67108863 & t, (t / 67108864) & 67108863]), (this.length = 2))
									: (e(t < 9007199254740992),
									  (this.words = [67108863 & t, (t / 67108864) & 67108863, 1]),
									  (this.length = 3)),
								'le' === i && this._initArray(this.toArray(), r, i);
						}),
						(o.prototype._initArray = function (t, r, i) {
							if ((e('number' == typeof t.length), t.length <= 0))
								return (this.words = [0]), (this.length = 1), this;
							(this.length = Math.ceil(t.length / 3)), (this.words = new Array(this.length));
							for (var n = 0; n < this.length; n++) this.words[n] = 0;
							var o,
								s,
								h = 0;
							if ('be' === i)
								for (n = t.length - 1, o = 0; n >= 0; n -= 3)
									(s = t[n] | (t[n - 1] << 8) | (t[n - 2] << 16)),
										(this.words[o] |= (s << h) & 67108863),
										(this.words[o + 1] = (s >>> (26 - h)) & 67108863),
										(h += 24) >= 26 && ((h -= 26), o++);
							else if ('le' === i)
								for (n = 0, o = 0; n < t.length; n += 3)
									(s = t[n] | (t[n + 1] << 8) | (t[n + 2] << 16)),
										(this.words[o] |= (s << h) & 67108863),
										(this.words[o + 1] = (s >>> (26 - h)) & 67108863),
										(h += 24) >= 26 && ((h -= 26), o++);
							return this._strip();
						}),
						(o.prototype._parseHex = function (t, r, i) {
							(this.length = Math.ceil((t.length - r) / 6)), (this.words = new Array(this.length));
							for (var e = 0; e < this.length; e++) this.words[e] = 0;
							var n,
								o = 0,
								s = 0;
							if ('be' === i)
								for (e = t.length - 1; e >= r; e -= 2)
									(n = u(t, r, e) << o),
										(this.words[s] |= 67108863 & n),
										o >= 18 ? ((o -= 18), (s += 1), (this.words[s] |= n >>> 26)) : (o += 8);
							else
								for (e = (t.length - r) % 2 == 0 ? r + 1 : r; e < t.length; e += 2)
									(n = u(t, r, e) << o),
										(this.words[s] |= 67108863 & n),
										o >= 18 ? ((o -= 18), (s += 1), (this.words[s] |= n >>> 26)) : (o += 8);
							this._strip();
						}),
						(o.prototype._parseBase = function (t, r, i) {
							(this.words = [0]), (this.length = 1);
							for (var e = 0, n = 1; n <= 67108863; n *= r) e++;
							e--, (n = (n / r) | 0);
							for (
								var o = t.length - i, s = o % e, h = Math.min(o, o - s) + i, u = 0, l = i;
								l < h;
								l += e
							)
								(u = a(t, l, l + e, r)),
									this.imuln(n),
									this.words[0] + u < 67108864 ? (this.words[0] += u) : this._iaddn(u);
							if (0 !== s) {
								var f = 1;
								for (u = a(t, l, t.length, r), l = 0; l < s; l++) f *= r;
								this.imuln(f), this.words[0] + u < 67108864 ? (this.words[0] += u) : this._iaddn(u);
							}
							this._strip();
						}),
						(o.prototype.copy = function (t) {
							t.words = new Array(this.length);
							for (var r = 0; r < this.length; r++) t.words[r] = this.words[r];
							(t.length = this.length), (t.negative = this.negative), (t.red = this.red);
						}),
						(o.prototype._move = function (t) {
							l(t, this);
						}),
						(o.prototype.clone = function () {
							var t = new o(null);
							return this.copy(t), t;
						}),
						(o.prototype._expand = function (t) {
							for (; this.length < t; ) this.words[this.length++] = 0;
							return this;
						}),
						(o.prototype._strip = function () {
							for (; this.length > 1 && 0 === this.words[this.length - 1]; ) this.length--;
							return this._normSign();
						}),
						(o.prototype._normSign = function () {
							return 1 === this.length && 0 === this.words[0] && (this.negative = 0), this;
						}),
						'undefined' != typeof Symbol && 'function' == typeof Symbol.for)
					)
						try {
							o.prototype[Symbol.for('nodejs.util.inspect.custom')] = f;
						} catch (t) {
							o.prototype.inspect = f;
						}
					else o.prototype.inspect = f;
					function f() {
						return (this.red ? '<BN-R: ' : '<BN: ') + this.toString(16) + '>';
					}
					var m = [
							'',
							'0',
							'00',
							'000',
							'0000',
							'00000',
							'000000',
							'0000000',
							'00000000',
							'000000000',
							'0000000000',
							'00000000000',
							'000000000000',
							'0000000000000',
							'00000000000000',
							'000000000000000',
							'0000000000000000',
							'00000000000000000',
							'000000000000000000',
							'0000000000000000000',
							'00000000000000000000',
							'000000000000000000000',
							'0000000000000000000000',
							'00000000000000000000000',
							'000000000000000000000000',
							'0000000000000000000000000',
						],
						c = [
							0, 0, 25, 16, 12, 11, 10, 9, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5,
							5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
						],
						d = [
							0, 0, 33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216, 43046721,
							1e7, 19487171, 35831808, 62748517, 7529536, 11390625, 16777216, 24137569, 34012224,
							47045881, 64e6, 4084101, 5153632, 6436343, 7962624, 9765625, 11881376, 14348907,
							17210368, 20511149, 243e5, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176,
						];
					(o.prototype.toString = function (t, r) {
						var i;
						if (((r = 0 | r || 1), 16 === (t = t || 10) || 'hex' === t)) {
							i = '';
							for (var n = 0, o = 0, s = 0; s < this.length; s++) {
								var h = this.words[s],
									u = (16777215 & ((h << n) | o)).toString(16);
								(o = (h >>> (24 - n)) & 16777215),
									(n += 2) >= 26 && ((n -= 26), s--),
									(i = 0 !== o || s !== this.length - 1 ? m[6 - u.length] + u + i : u + i);
							}
							for (0 !== o && (i = o.toString(16) + i); i.length % r != 0; ) i = '0' + i;
							return 0 !== this.negative && (i = '-' + i), i;
						}
						if (t === (0 | t) && t >= 2 && t <= 36) {
							var a = c[t],
								l = d[t];
							i = '';
							var f = this.clone();
							for (f.negative = 0; !f.isZero(); ) {
								var p = f.modrn(l).toString(t);
								i = (f = f.idivn(l)).isZero() ? p + i : m[a - p.length] + p + i;
							}
							for (this.isZero() && (i = '0' + i); i.length % r != 0; ) i = '0' + i;
							return 0 !== this.negative && (i = '-' + i), i;
						}
						e(!1, 'Base should be between 2 and 36');
					}),
						(o.prototype.toNumber = function () {
							var t = this.words[0];
							return (
								2 === this.length
									? (t += 67108864 * this.words[1])
									: 3 === this.length && 1 === this.words[2]
									? (t += 4503599627370496 + 67108864 * this.words[1])
									: this.length > 2 && e(!1, 'Number can only safely store up to 53 bits'),
								0 !== this.negative ? -t : t
							);
						}),
						(o.prototype.toJSON = function () {
							return this.toString(16, 2);
						}),
						s &&
							(o.prototype.toBuffer = function (t, r) {
								return this.toArrayLike(s, t, r);
							}),
						(o.prototype.toArray = function (t, r) {
							return this.toArrayLike(Array, t, r);
						});
					function p(t, r, i) {
						i.negative = r.negative ^ t.negative;
						var e = (t.length + r.length) | 0;
						(i.length = e), (e = (e - 1) | 0);
						var n = 0 | t.words[0],
							o = 0 | r.words[0],
							s = n * o,
							h = 67108863 & s,
							u = (s / 67108864) | 0;
						i.words[0] = h;
						for (var a = 1; a < e; a++) {
							for (
								var l = u >>> 26,
									f = 67108863 & u,
									m = Math.min(a, r.length - 1),
									c = Math.max(0, a - t.length + 1);
								c <= m;
								c++
							) {
								var d = (a - c) | 0;
								(l += ((s = (n = 0 | t.words[d]) * (o = 0 | r.words[c]) + f) / 67108864) | 0),
									(f = 67108863 & s);
							}
							(i.words[a] = 0 | f), (u = 0 | l);
						}
						return 0 !== u ? (i.words[a] = 0 | u) : i.length--, i._strip();
					}
					(o.prototype.toArrayLike = function (t, r, i) {
						this._strip();
						var n = this.byteLength(),
							o = i || Math.max(1, n);
						e(n <= o, 'byte array longer than desired length'),
							e(o > 0, 'Requested array length <= 0');
						var s = (function (t, r) {
							return t.allocUnsafe ? t.allocUnsafe(r) : new t(r);
						})(t, o);
						return this['_toArrayLike' + ('le' === r ? 'LE' : 'BE')](s, n), s;
					}),
						(o.prototype._toArrayLikeLE = function (t, r) {
							for (var i = 0, e = 0, n = 0, o = 0; n < this.length; n++) {
								var s = (this.words[n] << o) | e;
								(t[i++] = 255 & s),
									i < t.length && (t[i++] = (s >> 8) & 255),
									i < t.length && (t[i++] = (s >> 16) & 255),
									6 === o
										? (i < t.length && (t[i++] = (s >> 24) & 255), (e = 0), (o = 0))
										: ((e = s >>> 24), (o += 2));
							}
							if (i < t.length) for (t[i++] = e; i < t.length; ) t[i++] = 0;
						}),
						(o.prototype._toArrayLikeBE = function (t, r) {
							for (var i = t.length - 1, e = 0, n = 0, o = 0; n < this.length; n++) {
								var s = (this.words[n] << o) | e;
								(t[i--] = 255 & s),
									i >= 0 && (t[i--] = (s >> 8) & 255),
									i >= 0 && (t[i--] = (s >> 16) & 255),
									6 === o
										? (i >= 0 && (t[i--] = (s >> 24) & 255), (e = 0), (o = 0))
										: ((e = s >>> 24), (o += 2));
							}
							if (i >= 0) for (t[i--] = e; i >= 0; ) t[i--] = 0;
						}),
						Math.clz32
							? (o.prototype._countBits = function (t) {
									return 32 - Math.clz32(t);
							  })
							: (o.prototype._countBits = function (t) {
									var r = t,
										i = 0;
									return (
										r >= 4096 && ((i += 13), (r >>>= 13)),
										r >= 64 && ((i += 7), (r >>>= 7)),
										r >= 8 && ((i += 4), (r >>>= 4)),
										r >= 2 && ((i += 2), (r >>>= 2)),
										i + r
									);
							  }),
						(o.prototype._zeroBits = function (t) {
							if (0 === t) return 26;
							var r = t,
								i = 0;
							return (
								0 == (8191 & r) && ((i += 13), (r >>>= 13)),
								0 == (127 & r) && ((i += 7), (r >>>= 7)),
								0 == (15 & r) && ((i += 4), (r >>>= 4)),
								0 == (3 & r) && ((i += 2), (r >>>= 2)),
								0 == (1 & r) && i++,
								i
							);
						}),
						(o.prototype.bitLength = function () {
							var t = this.words[this.length - 1],
								r = this._countBits(t);
							return 26 * (this.length - 1) + r;
						}),
						(o.prototype.zeroBits = function () {
							if (this.isZero()) return 0;
							for (var t = 0, r = 0; r < this.length; r++) {
								var i = this._zeroBits(this.words[r]);
								if (((t += i), 26 !== i)) break;
							}
							return t;
						}),
						(o.prototype.byteLength = function () {
							return Math.ceil(this.bitLength() / 8);
						}),
						(o.prototype.toTwos = function (t) {
							return 0 !== this.negative ? this.abs().inotn(t).iaddn(1) : this.clone();
						}),
						(o.prototype.fromTwos = function (t) {
							return this.testn(t - 1) ? this.notn(t).iaddn(1).ineg() : this.clone();
						}),
						(o.prototype.isNeg = function () {
							return 0 !== this.negative;
						}),
						(o.prototype.neg = function () {
							return this.clone().ineg();
						}),
						(o.prototype.ineg = function () {
							return this.isZero() || (this.negative ^= 1), this;
						}),
						(o.prototype.iuor = function (t) {
							for (; this.length < t.length; ) this.words[this.length++] = 0;
							for (var r = 0; r < t.length; r++) this.words[r] = this.words[r] | t.words[r];
							return this._strip();
						}),
						(o.prototype.ior = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuor(t);
						}),
						(o.prototype.or = function (t) {
							return this.length > t.length ? this.clone().ior(t) : t.clone().ior(this);
						}),
						(o.prototype.uor = function (t) {
							return this.length > t.length ? this.clone().iuor(t) : t.clone().iuor(this);
						}),
						(o.prototype.iuand = function (t) {
							var r;
							r = this.length > t.length ? t : this;
							for (var i = 0; i < r.length; i++) this.words[i] = this.words[i] & t.words[i];
							return (this.length = r.length), this._strip();
						}),
						(o.prototype.iand = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuand(t);
						}),
						(o.prototype.and = function (t) {
							return this.length > t.length ? this.clone().iand(t) : t.clone().iand(this);
						}),
						(o.prototype.uand = function (t) {
							return this.length > t.length ? this.clone().iuand(t) : t.clone().iuand(this);
						}),
						(o.prototype.iuxor = function (t) {
							var r, i;
							this.length > t.length ? ((r = this), (i = t)) : ((r = t), (i = this));
							for (var e = 0; e < i.length; e++) this.words[e] = r.words[e] ^ i.words[e];
							if (this !== r) for (; e < r.length; e++) this.words[e] = r.words[e];
							return (this.length = r.length), this._strip();
						}),
						(o.prototype.ixor = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuxor(t);
						}),
						(o.prototype.xor = function (t) {
							return this.length > t.length ? this.clone().ixor(t) : t.clone().ixor(this);
						}),
						(o.prototype.uxor = function (t) {
							return this.length > t.length ? this.clone().iuxor(t) : t.clone().iuxor(this);
						}),
						(o.prototype.inotn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = 0 | Math.ceil(t / 26),
								i = t % 26;
							this._expand(r), i > 0 && r--;
							for (var n = 0; n < r; n++) this.words[n] = 67108863 & ~this.words[n];
							return (
								i > 0 && (this.words[n] = ~this.words[n] & (67108863 >> (26 - i))), this._strip()
							);
						}),
						(o.prototype.notn = function (t) {
							return this.clone().inotn(t);
						}),
						(o.prototype.setn = function (t, r) {
							e('number' == typeof t && t >= 0);
							var i = (t / 26) | 0,
								n = t % 26;
							return (
								this._expand(i + 1),
								(this.words[i] = r ? this.words[i] | (1 << n) : this.words[i] & ~(1 << n)),
								this._strip()
							);
						}),
						(o.prototype.iadd = function (t) {
							var r, i, e;
							if (0 !== this.negative && 0 === t.negative)
								return (
									(this.negative = 0), (r = this.isub(t)), (this.negative ^= 1), this._normSign()
								);
							if (0 === this.negative && 0 !== t.negative)
								return (t.negative = 0), (r = this.isub(t)), (t.negative = 1), r._normSign();
							this.length > t.length ? ((i = this), (e = t)) : ((i = t), (e = this));
							for (var n = 0, o = 0; o < e.length; o++)
								(r = (0 | i.words[o]) + (0 | e.words[o]) + n),
									(this.words[o] = 67108863 & r),
									(n = r >>> 26);
							for (; 0 !== n && o < i.length; o++)
								(r = (0 | i.words[o]) + n), (this.words[o] = 67108863 & r), (n = r >>> 26);
							if (((this.length = i.length), 0 !== n)) (this.words[this.length] = n), this.length++;
							else if (i !== this) for (; o < i.length; o++) this.words[o] = i.words[o];
							return this;
						}),
						(o.prototype.add = function (t) {
							var r;
							return 0 !== t.negative && 0 === this.negative
								? ((t.negative = 0), (r = this.sub(t)), (t.negative ^= 1), r)
								: 0 === t.negative && 0 !== this.negative
								? ((this.negative = 0), (r = t.sub(this)), (this.negative = 1), r)
								: this.length > t.length
								? this.clone().iadd(t)
								: t.clone().iadd(this);
						}),
						(o.prototype.isub = function (t) {
							if (0 !== t.negative) {
								t.negative = 0;
								var r = this.iadd(t);
								return (t.negative = 1), r._normSign();
							}
							if (0 !== this.negative)
								return (this.negative = 0), this.iadd(t), (this.negative = 1), this._normSign();
							var i,
								e,
								n = this.cmp(t);
							if (0 === n) return (this.negative = 0), (this.length = 1), (this.words[0] = 0), this;
							n > 0 ? ((i = this), (e = t)) : ((i = t), (e = this));
							for (var o = 0, s = 0; s < e.length; s++)
								(o = (r = (0 | i.words[s]) - (0 | e.words[s]) + o) >> 26),
									(this.words[s] = 67108863 & r);
							for (; 0 !== o && s < i.length; s++)
								(o = (r = (0 | i.words[s]) + o) >> 26), (this.words[s] = 67108863 & r);
							if (0 === o && s < i.length && i !== this)
								for (; s < i.length; s++) this.words[s] = i.words[s];
							return (
								(this.length = Math.max(this.length, s)),
								i !== this && (this.negative = 1),
								this._strip()
							);
						}),
						(o.prototype.sub = function (t) {
							return this.clone().isub(t);
						});
					var g = function (t, r, i) {
						var e,
							n,
							o,
							s = t.words,
							h = r.words,
							u = i.words,
							a = 0,
							l = 0 | s[0],
							f = 8191 & l,
							m = l >>> 13,
							c = 0 | s[1],
							d = 8191 & c,
							p = c >>> 13,
							g = 0 | s[2],
							v = 8191 & g,
							y = g >>> 13,
							w = 0 | s[3],
							M = 8191 & w,
							b = w >>> 13,
							_ = 0 | s[4],
							A = 8191 & _,
							E = _ >>> 13,
							x = 0 | s[5],
							S = 8191 & x,
							N = x >>> 13,
							T = 0 | s[6],
							R = 8191 & T,
							k = T >>> 13,
							I = 0 | s[7],
							B = 8191 & I,
							O = I >>> 13,
							C = 0 | s[8],
							L = 8191 & C,
							j = C >>> 13,
							P = 0 | s[9],
							U = 8191 & P,
							F = P >>> 13,
							D = 0 | h[0],
							Z = 8191 & D,
							z = D >>> 13,
							q = 0 | h[1],
							H = 8191 & q,
							W = q >>> 13,
							G = 0 | h[2],
							Y = 8191 & G,
							$ = G >>> 13,
							V = 0 | h[3],
							J = 8191 & V,
							K = V >>> 13,
							X = 0 | h[4],
							Q = 8191 & X,
							tt = X >>> 13,
							rt = 0 | h[5],
							it = 8191 & rt,
							et = rt >>> 13,
							nt = 0 | h[6],
							ot = 8191 & nt,
							st = nt >>> 13,
							ht = 0 | h[7],
							ut = 8191 & ht,
							at = ht >>> 13,
							lt = 0 | h[8],
							ft = 8191 & lt,
							mt = lt >>> 13,
							ct = 0 | h[9],
							dt = 8191 & ct,
							pt = ct >>> 13;
						(i.negative = t.negative ^ r.negative), (i.length = 19);
						var gt =
							(((a + (e = Math.imul(f, Z))) | 0) +
								((8191 & (n = ((n = Math.imul(f, z)) + Math.imul(m, Z)) | 0)) << 13)) |
							0;
						(a = ((((o = Math.imul(m, z)) + (n >>> 13)) | 0) + (gt >>> 26)) | 0),
							(gt &= 67108863),
							(e = Math.imul(d, Z)),
							(n = ((n = Math.imul(d, z)) + Math.imul(p, Z)) | 0),
							(o = Math.imul(p, z));
						var vt =
							(((a + (e = (e + Math.imul(f, H)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, W)) | 0) + Math.imul(m, H)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, W)) | 0) + (n >>> 13)) | 0) + (vt >>> 26)) | 0),
							(vt &= 67108863),
							(e = Math.imul(v, Z)),
							(n = ((n = Math.imul(v, z)) + Math.imul(y, Z)) | 0),
							(o = Math.imul(y, z)),
							(e = (e + Math.imul(d, H)) | 0),
							(n = ((n = (n + Math.imul(d, W)) | 0) + Math.imul(p, H)) | 0),
							(o = (o + Math.imul(p, W)) | 0);
						var yt =
							(((a + (e = (e + Math.imul(f, Y)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, $)) | 0) + Math.imul(m, Y)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, $)) | 0) + (n >>> 13)) | 0) + (yt >>> 26)) | 0),
							(yt &= 67108863),
							(e = Math.imul(M, Z)),
							(n = ((n = Math.imul(M, z)) + Math.imul(b, Z)) | 0),
							(o = Math.imul(b, z)),
							(e = (e + Math.imul(v, H)) | 0),
							(n = ((n = (n + Math.imul(v, W)) | 0) + Math.imul(y, H)) | 0),
							(o = (o + Math.imul(y, W)) | 0),
							(e = (e + Math.imul(d, Y)) | 0),
							(n = ((n = (n + Math.imul(d, $)) | 0) + Math.imul(p, Y)) | 0),
							(o = (o + Math.imul(p, $)) | 0);
						var wt =
							(((a + (e = (e + Math.imul(f, J)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, K)) | 0) + Math.imul(m, J)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, K)) | 0) + (n >>> 13)) | 0) + (wt >>> 26)) | 0),
							(wt &= 67108863),
							(e = Math.imul(A, Z)),
							(n = ((n = Math.imul(A, z)) + Math.imul(E, Z)) | 0),
							(o = Math.imul(E, z)),
							(e = (e + Math.imul(M, H)) | 0),
							(n = ((n = (n + Math.imul(M, W)) | 0) + Math.imul(b, H)) | 0),
							(o = (o + Math.imul(b, W)) | 0),
							(e = (e + Math.imul(v, Y)) | 0),
							(n = ((n = (n + Math.imul(v, $)) | 0) + Math.imul(y, Y)) | 0),
							(o = (o + Math.imul(y, $)) | 0),
							(e = (e + Math.imul(d, J)) | 0),
							(n = ((n = (n + Math.imul(d, K)) | 0) + Math.imul(p, J)) | 0),
							(o = (o + Math.imul(p, K)) | 0);
						var Mt =
							(((a + (e = (e + Math.imul(f, Q)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, tt)) | 0) + Math.imul(m, Q)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, tt)) | 0) + (n >>> 13)) | 0) + (Mt >>> 26)) | 0),
							(Mt &= 67108863),
							(e = Math.imul(S, Z)),
							(n = ((n = Math.imul(S, z)) + Math.imul(N, Z)) | 0),
							(o = Math.imul(N, z)),
							(e = (e + Math.imul(A, H)) | 0),
							(n = ((n = (n + Math.imul(A, W)) | 0) + Math.imul(E, H)) | 0),
							(o = (o + Math.imul(E, W)) | 0),
							(e = (e + Math.imul(M, Y)) | 0),
							(n = ((n = (n + Math.imul(M, $)) | 0) + Math.imul(b, Y)) | 0),
							(o = (o + Math.imul(b, $)) | 0),
							(e = (e + Math.imul(v, J)) | 0),
							(n = ((n = (n + Math.imul(v, K)) | 0) + Math.imul(y, J)) | 0),
							(o = (o + Math.imul(y, K)) | 0),
							(e = (e + Math.imul(d, Q)) | 0),
							(n = ((n = (n + Math.imul(d, tt)) | 0) + Math.imul(p, Q)) | 0),
							(o = (o + Math.imul(p, tt)) | 0);
						var bt =
							(((a + (e = (e + Math.imul(f, it)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, et)) | 0) + Math.imul(m, it)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, et)) | 0) + (n >>> 13)) | 0) + (bt >>> 26)) | 0),
							(bt &= 67108863),
							(e = Math.imul(R, Z)),
							(n = ((n = Math.imul(R, z)) + Math.imul(k, Z)) | 0),
							(o = Math.imul(k, z)),
							(e = (e + Math.imul(S, H)) | 0),
							(n = ((n = (n + Math.imul(S, W)) | 0) + Math.imul(N, H)) | 0),
							(o = (o + Math.imul(N, W)) | 0),
							(e = (e + Math.imul(A, Y)) | 0),
							(n = ((n = (n + Math.imul(A, $)) | 0) + Math.imul(E, Y)) | 0),
							(o = (o + Math.imul(E, $)) | 0),
							(e = (e + Math.imul(M, J)) | 0),
							(n = ((n = (n + Math.imul(M, K)) | 0) + Math.imul(b, J)) | 0),
							(o = (o + Math.imul(b, K)) | 0),
							(e = (e + Math.imul(v, Q)) | 0),
							(n = ((n = (n + Math.imul(v, tt)) | 0) + Math.imul(y, Q)) | 0),
							(o = (o + Math.imul(y, tt)) | 0),
							(e = (e + Math.imul(d, it)) | 0),
							(n = ((n = (n + Math.imul(d, et)) | 0) + Math.imul(p, it)) | 0),
							(o = (o + Math.imul(p, et)) | 0);
						var _t =
							(((a + (e = (e + Math.imul(f, ot)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, st)) | 0) + Math.imul(m, ot)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, st)) | 0) + (n >>> 13)) | 0) + (_t >>> 26)) | 0),
							(_t &= 67108863),
							(e = Math.imul(B, Z)),
							(n = ((n = Math.imul(B, z)) + Math.imul(O, Z)) | 0),
							(o = Math.imul(O, z)),
							(e = (e + Math.imul(R, H)) | 0),
							(n = ((n = (n + Math.imul(R, W)) | 0) + Math.imul(k, H)) | 0),
							(o = (o + Math.imul(k, W)) | 0),
							(e = (e + Math.imul(S, Y)) | 0),
							(n = ((n = (n + Math.imul(S, $)) | 0) + Math.imul(N, Y)) | 0),
							(o = (o + Math.imul(N, $)) | 0),
							(e = (e + Math.imul(A, J)) | 0),
							(n = ((n = (n + Math.imul(A, K)) | 0) + Math.imul(E, J)) | 0),
							(o = (o + Math.imul(E, K)) | 0),
							(e = (e + Math.imul(M, Q)) | 0),
							(n = ((n = (n + Math.imul(M, tt)) | 0) + Math.imul(b, Q)) | 0),
							(o = (o + Math.imul(b, tt)) | 0),
							(e = (e + Math.imul(v, it)) | 0),
							(n = ((n = (n + Math.imul(v, et)) | 0) + Math.imul(y, it)) | 0),
							(o = (o + Math.imul(y, et)) | 0),
							(e = (e + Math.imul(d, ot)) | 0),
							(n = ((n = (n + Math.imul(d, st)) | 0) + Math.imul(p, ot)) | 0),
							(o = (o + Math.imul(p, st)) | 0);
						var At =
							(((a + (e = (e + Math.imul(f, ut)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, at)) | 0) + Math.imul(m, ut)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, at)) | 0) + (n >>> 13)) | 0) + (At >>> 26)) | 0),
							(At &= 67108863),
							(e = Math.imul(L, Z)),
							(n = ((n = Math.imul(L, z)) + Math.imul(j, Z)) | 0),
							(o = Math.imul(j, z)),
							(e = (e + Math.imul(B, H)) | 0),
							(n = ((n = (n + Math.imul(B, W)) | 0) + Math.imul(O, H)) | 0),
							(o = (o + Math.imul(O, W)) | 0),
							(e = (e + Math.imul(R, Y)) | 0),
							(n = ((n = (n + Math.imul(R, $)) | 0) + Math.imul(k, Y)) | 0),
							(o = (o + Math.imul(k, $)) | 0),
							(e = (e + Math.imul(S, J)) | 0),
							(n = ((n = (n + Math.imul(S, K)) | 0) + Math.imul(N, J)) | 0),
							(o = (o + Math.imul(N, K)) | 0),
							(e = (e + Math.imul(A, Q)) | 0),
							(n = ((n = (n + Math.imul(A, tt)) | 0) + Math.imul(E, Q)) | 0),
							(o = (o + Math.imul(E, tt)) | 0),
							(e = (e + Math.imul(M, it)) | 0),
							(n = ((n = (n + Math.imul(M, et)) | 0) + Math.imul(b, it)) | 0),
							(o = (o + Math.imul(b, et)) | 0),
							(e = (e + Math.imul(v, ot)) | 0),
							(n = ((n = (n + Math.imul(v, st)) | 0) + Math.imul(y, ot)) | 0),
							(o = (o + Math.imul(y, st)) | 0),
							(e = (e + Math.imul(d, ut)) | 0),
							(n = ((n = (n + Math.imul(d, at)) | 0) + Math.imul(p, ut)) | 0),
							(o = (o + Math.imul(p, at)) | 0);
						var Et =
							(((a + (e = (e + Math.imul(f, ft)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, mt)) | 0) + Math.imul(m, ft)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, mt)) | 0) + (n >>> 13)) | 0) + (Et >>> 26)) | 0),
							(Et &= 67108863),
							(e = Math.imul(U, Z)),
							(n = ((n = Math.imul(U, z)) + Math.imul(F, Z)) | 0),
							(o = Math.imul(F, z)),
							(e = (e + Math.imul(L, H)) | 0),
							(n = ((n = (n + Math.imul(L, W)) | 0) + Math.imul(j, H)) | 0),
							(o = (o + Math.imul(j, W)) | 0),
							(e = (e + Math.imul(B, Y)) | 0),
							(n = ((n = (n + Math.imul(B, $)) | 0) + Math.imul(O, Y)) | 0),
							(o = (o + Math.imul(O, $)) | 0),
							(e = (e + Math.imul(R, J)) | 0),
							(n = ((n = (n + Math.imul(R, K)) | 0) + Math.imul(k, J)) | 0),
							(o = (o + Math.imul(k, K)) | 0),
							(e = (e + Math.imul(S, Q)) | 0),
							(n = ((n = (n + Math.imul(S, tt)) | 0) + Math.imul(N, Q)) | 0),
							(o = (o + Math.imul(N, tt)) | 0),
							(e = (e + Math.imul(A, it)) | 0),
							(n = ((n = (n + Math.imul(A, et)) | 0) + Math.imul(E, it)) | 0),
							(o = (o + Math.imul(E, et)) | 0),
							(e = (e + Math.imul(M, ot)) | 0),
							(n = ((n = (n + Math.imul(M, st)) | 0) + Math.imul(b, ot)) | 0),
							(o = (o + Math.imul(b, st)) | 0),
							(e = (e + Math.imul(v, ut)) | 0),
							(n = ((n = (n + Math.imul(v, at)) | 0) + Math.imul(y, ut)) | 0),
							(o = (o + Math.imul(y, at)) | 0),
							(e = (e + Math.imul(d, ft)) | 0),
							(n = ((n = (n + Math.imul(d, mt)) | 0) + Math.imul(p, ft)) | 0),
							(o = (o + Math.imul(p, mt)) | 0);
						var xt =
							(((a + (e = (e + Math.imul(f, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, pt)) | 0) + Math.imul(m, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, pt)) | 0) + (n >>> 13)) | 0) + (xt >>> 26)) | 0),
							(xt &= 67108863),
							(e = Math.imul(U, H)),
							(n = ((n = Math.imul(U, W)) + Math.imul(F, H)) | 0),
							(o = Math.imul(F, W)),
							(e = (e + Math.imul(L, Y)) | 0),
							(n = ((n = (n + Math.imul(L, $)) | 0) + Math.imul(j, Y)) | 0),
							(o = (o + Math.imul(j, $)) | 0),
							(e = (e + Math.imul(B, J)) | 0),
							(n = ((n = (n + Math.imul(B, K)) | 0) + Math.imul(O, J)) | 0),
							(o = (o + Math.imul(O, K)) | 0),
							(e = (e + Math.imul(R, Q)) | 0),
							(n = ((n = (n + Math.imul(R, tt)) | 0) + Math.imul(k, Q)) | 0),
							(o = (o + Math.imul(k, tt)) | 0),
							(e = (e + Math.imul(S, it)) | 0),
							(n = ((n = (n + Math.imul(S, et)) | 0) + Math.imul(N, it)) | 0),
							(o = (o + Math.imul(N, et)) | 0),
							(e = (e + Math.imul(A, ot)) | 0),
							(n = ((n = (n + Math.imul(A, st)) | 0) + Math.imul(E, ot)) | 0),
							(o = (o + Math.imul(E, st)) | 0),
							(e = (e + Math.imul(M, ut)) | 0),
							(n = ((n = (n + Math.imul(M, at)) | 0) + Math.imul(b, ut)) | 0),
							(o = (o + Math.imul(b, at)) | 0),
							(e = (e + Math.imul(v, ft)) | 0),
							(n = ((n = (n + Math.imul(v, mt)) | 0) + Math.imul(y, ft)) | 0),
							(o = (o + Math.imul(y, mt)) | 0);
						var St =
							(((a + (e = (e + Math.imul(d, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(d, pt)) | 0) + Math.imul(p, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(p, pt)) | 0) + (n >>> 13)) | 0) + (St >>> 26)) | 0),
							(St &= 67108863),
							(e = Math.imul(U, Y)),
							(n = ((n = Math.imul(U, $)) + Math.imul(F, Y)) | 0),
							(o = Math.imul(F, $)),
							(e = (e + Math.imul(L, J)) | 0),
							(n = ((n = (n + Math.imul(L, K)) | 0) + Math.imul(j, J)) | 0),
							(o = (o + Math.imul(j, K)) | 0),
							(e = (e + Math.imul(B, Q)) | 0),
							(n = ((n = (n + Math.imul(B, tt)) | 0) + Math.imul(O, Q)) | 0),
							(o = (o + Math.imul(O, tt)) | 0),
							(e = (e + Math.imul(R, it)) | 0),
							(n = ((n = (n + Math.imul(R, et)) | 0) + Math.imul(k, it)) | 0),
							(o = (o + Math.imul(k, et)) | 0),
							(e = (e + Math.imul(S, ot)) | 0),
							(n = ((n = (n + Math.imul(S, st)) | 0) + Math.imul(N, ot)) | 0),
							(o = (o + Math.imul(N, st)) | 0),
							(e = (e + Math.imul(A, ut)) | 0),
							(n = ((n = (n + Math.imul(A, at)) | 0) + Math.imul(E, ut)) | 0),
							(o = (o + Math.imul(E, at)) | 0),
							(e = (e + Math.imul(M, ft)) | 0),
							(n = ((n = (n + Math.imul(M, mt)) | 0) + Math.imul(b, ft)) | 0),
							(o = (o + Math.imul(b, mt)) | 0);
						var Nt =
							(((a + (e = (e + Math.imul(v, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(v, pt)) | 0) + Math.imul(y, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(y, pt)) | 0) + (n >>> 13)) | 0) + (Nt >>> 26)) | 0),
							(Nt &= 67108863),
							(e = Math.imul(U, J)),
							(n = ((n = Math.imul(U, K)) + Math.imul(F, J)) | 0),
							(o = Math.imul(F, K)),
							(e = (e + Math.imul(L, Q)) | 0),
							(n = ((n = (n + Math.imul(L, tt)) | 0) + Math.imul(j, Q)) | 0),
							(o = (o + Math.imul(j, tt)) | 0),
							(e = (e + Math.imul(B, it)) | 0),
							(n = ((n = (n + Math.imul(B, et)) | 0) + Math.imul(O, it)) | 0),
							(o = (o + Math.imul(O, et)) | 0),
							(e = (e + Math.imul(R, ot)) | 0),
							(n = ((n = (n + Math.imul(R, st)) | 0) + Math.imul(k, ot)) | 0),
							(o = (o + Math.imul(k, st)) | 0),
							(e = (e + Math.imul(S, ut)) | 0),
							(n = ((n = (n + Math.imul(S, at)) | 0) + Math.imul(N, ut)) | 0),
							(o = (o + Math.imul(N, at)) | 0),
							(e = (e + Math.imul(A, ft)) | 0),
							(n = ((n = (n + Math.imul(A, mt)) | 0) + Math.imul(E, ft)) | 0),
							(o = (o + Math.imul(E, mt)) | 0);
						var Tt =
							(((a + (e = (e + Math.imul(M, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(M, pt)) | 0) + Math.imul(b, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(b, pt)) | 0) + (n >>> 13)) | 0) + (Tt >>> 26)) | 0),
							(Tt &= 67108863),
							(e = Math.imul(U, Q)),
							(n = ((n = Math.imul(U, tt)) + Math.imul(F, Q)) | 0),
							(o = Math.imul(F, tt)),
							(e = (e + Math.imul(L, it)) | 0),
							(n = ((n = (n + Math.imul(L, et)) | 0) + Math.imul(j, it)) | 0),
							(o = (o + Math.imul(j, et)) | 0),
							(e = (e + Math.imul(B, ot)) | 0),
							(n = ((n = (n + Math.imul(B, st)) | 0) + Math.imul(O, ot)) | 0),
							(o = (o + Math.imul(O, st)) | 0),
							(e = (e + Math.imul(R, ut)) | 0),
							(n = ((n = (n + Math.imul(R, at)) | 0) + Math.imul(k, ut)) | 0),
							(o = (o + Math.imul(k, at)) | 0),
							(e = (e + Math.imul(S, ft)) | 0),
							(n = ((n = (n + Math.imul(S, mt)) | 0) + Math.imul(N, ft)) | 0),
							(o = (o + Math.imul(N, mt)) | 0);
						var Rt =
							(((a + (e = (e + Math.imul(A, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(A, pt)) | 0) + Math.imul(E, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(E, pt)) | 0) + (n >>> 13)) | 0) + (Rt >>> 26)) | 0),
							(Rt &= 67108863),
							(e = Math.imul(U, it)),
							(n = ((n = Math.imul(U, et)) + Math.imul(F, it)) | 0),
							(o = Math.imul(F, et)),
							(e = (e + Math.imul(L, ot)) | 0),
							(n = ((n = (n + Math.imul(L, st)) | 0) + Math.imul(j, ot)) | 0),
							(o = (o + Math.imul(j, st)) | 0),
							(e = (e + Math.imul(B, ut)) | 0),
							(n = ((n = (n + Math.imul(B, at)) | 0) + Math.imul(O, ut)) | 0),
							(o = (o + Math.imul(O, at)) | 0),
							(e = (e + Math.imul(R, ft)) | 0),
							(n = ((n = (n + Math.imul(R, mt)) | 0) + Math.imul(k, ft)) | 0),
							(o = (o + Math.imul(k, mt)) | 0);
						var kt =
							(((a + (e = (e + Math.imul(S, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(S, pt)) | 0) + Math.imul(N, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(N, pt)) | 0) + (n >>> 13)) | 0) + (kt >>> 26)) | 0),
							(kt &= 67108863),
							(e = Math.imul(U, ot)),
							(n = ((n = Math.imul(U, st)) + Math.imul(F, ot)) | 0),
							(o = Math.imul(F, st)),
							(e = (e + Math.imul(L, ut)) | 0),
							(n = ((n = (n + Math.imul(L, at)) | 0) + Math.imul(j, ut)) | 0),
							(o = (o + Math.imul(j, at)) | 0),
							(e = (e + Math.imul(B, ft)) | 0),
							(n = ((n = (n + Math.imul(B, mt)) | 0) + Math.imul(O, ft)) | 0),
							(o = (o + Math.imul(O, mt)) | 0);
						var It =
							(((a + (e = (e + Math.imul(R, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(R, pt)) | 0) + Math.imul(k, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(k, pt)) | 0) + (n >>> 13)) | 0) + (It >>> 26)) | 0),
							(It &= 67108863),
							(e = Math.imul(U, ut)),
							(n = ((n = Math.imul(U, at)) + Math.imul(F, ut)) | 0),
							(o = Math.imul(F, at)),
							(e = (e + Math.imul(L, ft)) | 0),
							(n = ((n = (n + Math.imul(L, mt)) | 0) + Math.imul(j, ft)) | 0),
							(o = (o + Math.imul(j, mt)) | 0);
						var Bt =
							(((a + (e = (e + Math.imul(B, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(B, pt)) | 0) + Math.imul(O, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(O, pt)) | 0) + (n >>> 13)) | 0) + (Bt >>> 26)) | 0),
							(Bt &= 67108863),
							(e = Math.imul(U, ft)),
							(n = ((n = Math.imul(U, mt)) + Math.imul(F, ft)) | 0),
							(o = Math.imul(F, mt));
						var Ot =
							(((a + (e = (e + Math.imul(L, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(L, pt)) | 0) + Math.imul(j, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(j, pt)) | 0) + (n >>> 13)) | 0) + (Ot >>> 26)) | 0),
							(Ot &= 67108863);
						var Ct =
							(((a + (e = Math.imul(U, dt))) | 0) +
								((8191 & (n = ((n = Math.imul(U, pt)) + Math.imul(F, dt)) | 0)) << 13)) |
							0;
						return (
							(a = ((((o = Math.imul(F, pt)) + (n >>> 13)) | 0) + (Ct >>> 26)) | 0),
							(Ct &= 67108863),
							(u[0] = gt),
							(u[1] = vt),
							(u[2] = yt),
							(u[3] = wt),
							(u[4] = Mt),
							(u[5] = bt),
							(u[6] = _t),
							(u[7] = At),
							(u[8] = Et),
							(u[9] = xt),
							(u[10] = St),
							(u[11] = Nt),
							(u[12] = Tt),
							(u[13] = Rt),
							(u[14] = kt),
							(u[15] = It),
							(u[16] = Bt),
							(u[17] = Ot),
							(u[18] = Ct),
							0 !== a && ((u[19] = a), i.length++),
							i
						);
					};
					function v(t, r, i) {
						(i.negative = r.negative ^ t.negative), (i.length = t.length + r.length);
						for (var e = 0, n = 0, o = 0; o < i.length - 1; o++) {
							var s = n;
							n = 0;
							for (
								var h = 67108863 & e,
									u = Math.min(o, r.length - 1),
									a = Math.max(0, o - t.length + 1);
								a <= u;
								a++
							) {
								var l = o - a,
									f = (0 | t.words[l]) * (0 | r.words[a]),
									m = 67108863 & f;
								(h = 67108863 & (m = (m + h) | 0)),
									(n += (s = ((s = (s + ((f / 67108864) | 0)) | 0) + (m >>> 26)) | 0) >>> 26),
									(s &= 67108863);
							}
							(i.words[o] = h), (e = s), (s = n);
						}
						return 0 !== e ? (i.words[o] = e) : i.length--, i._strip();
					}
					function y(t, r, i) {
						return v(t, r, i);
					}
					function w(t, r) {
						(this.x = t), (this.y = r);
					}
					Math.imul || (g = p),
						(o.prototype.mulTo = function (t, r) {
							var i = this.length + t.length;
							return 10 === this.length && 10 === t.length
								? g(this, t, r)
								: i < 63
								? p(this, t, r)
								: i < 1024
								? v(this, t, r)
								: y(this, t, r);
						}),
						(w.prototype.makeRBT = function (t) {
							for (var r = new Array(t), i = o.prototype._countBits(t) - 1, e = 0; e < t; e++)
								r[e] = this.revBin(e, i, t);
							return r;
						}),
						(w.prototype.revBin = function (t, r, i) {
							if (0 === t || t === i - 1) return t;
							for (var e = 0, n = 0; n < r; n++) (e |= (1 & t) << (r - n - 1)), (t >>= 1);
							return e;
						}),
						(w.prototype.permute = function (t, r, i, e, n, o) {
							for (var s = 0; s < o; s++) (e[s] = r[t[s]]), (n[s] = i[t[s]]);
						}),
						(w.prototype.transform = function (t, r, i, e, n, o) {
							this.permute(o, t, r, i, e, n);
							for (var s = 1; s < n; s <<= 1)
								for (
									var h = s << 1,
										u = Math.cos((2 * Math.PI) / h),
										a = Math.sin((2 * Math.PI) / h),
										l = 0;
									l < n;
									l += h
								)
									for (var f = u, m = a, c = 0; c < s; c++) {
										var d = i[l + c],
											p = e[l + c],
											g = i[l + c + s],
											v = e[l + c + s],
											y = f * g - m * v;
										(v = f * v + m * g),
											(g = y),
											(i[l + c] = d + g),
											(e[l + c] = p + v),
											(i[l + c + s] = d - g),
											(e[l + c + s] = p - v),
											c !== h && ((y = u * f - a * m), (m = u * m + a * f), (f = y));
									}
						}),
						(w.prototype.guessLen13b = function (t, r) {
							var i = 1 | Math.max(r, t),
								e = 1 & i,
								n = 0;
							for (i = (i / 2) | 0; i; i >>>= 1) n++;
							return 1 << (n + 1 + e);
						}),
						(w.prototype.conjugate = function (t, r, i) {
							if (!(i <= 1))
								for (var e = 0; e < i / 2; e++) {
									var n = t[e];
									(t[e] = t[i - e - 1]),
										(t[i - e - 1] = n),
										(n = r[e]),
										(r[e] = -r[i - e - 1]),
										(r[i - e - 1] = -n);
								}
						}),
						(w.prototype.normalize13b = function (t, r) {
							for (var i = 0, e = 0; e < r / 2; e++) {
								var n = 8192 * Math.round(t[2 * e + 1] / r) + Math.round(t[2 * e] / r) + i;
								(t[e] = 67108863 & n), (i = n < 67108864 ? 0 : (n / 67108864) | 0);
							}
							return t;
						}),
						(w.prototype.convert13b = function (t, r, i, n) {
							for (var o = 0, s = 0; s < r; s++)
								(o += 0 | t[s]),
									(i[2 * s] = 8191 & o),
									(o >>>= 13),
									(i[2 * s + 1] = 8191 & o),
									(o >>>= 13);
							for (s = 2 * r; s < n; ++s) i[s] = 0;
							e(0 === o), e(0 == (-8192 & o));
						}),
						(w.prototype.stub = function (t) {
							for (var r = new Array(t), i = 0; i < t; i++) r[i] = 0;
							return r;
						}),
						(w.prototype.mulp = function (t, r, i) {
							var e = 2 * this.guessLen13b(t.length, r.length),
								n = this.makeRBT(e),
								o = this.stub(e),
								s = new Array(e),
								h = new Array(e),
								u = new Array(e),
								a = new Array(e),
								l = new Array(e),
								f = new Array(e),
								m = i.words;
							(m.length = e),
								this.convert13b(t.words, t.length, s, e),
								this.convert13b(r.words, r.length, a, e),
								this.transform(s, o, h, u, e, n),
								this.transform(a, o, l, f, e, n);
							for (var c = 0; c < e; c++) {
								var d = h[c] * l[c] - u[c] * f[c];
								(u[c] = h[c] * f[c] + u[c] * l[c]), (h[c] = d);
							}
							return (
								this.conjugate(h, u, e),
								this.transform(h, u, m, o, e, n),
								this.conjugate(m, o, e),
								this.normalize13b(m, e),
								(i.negative = t.negative ^ r.negative),
								(i.length = t.length + r.length),
								i._strip()
							);
						}),
						(o.prototype.mul = function (t) {
							var r = new o(null);
							return (r.words = new Array(this.length + t.length)), this.mulTo(t, r);
						}),
						(o.prototype.mulf = function (t) {
							var r = new o(null);
							return (r.words = new Array(this.length + t.length)), y(this, t, r);
						}),
						(o.prototype.imul = function (t) {
							return this.clone().mulTo(t, this);
						}),
						(o.prototype.imuln = function (t) {
							var r = t < 0;
							r && (t = -t), e('number' == typeof t), e(t < 67108864);
							for (var i = 0, n = 0; n < this.length; n++) {
								var o = (0 | this.words[n]) * t,
									s = (67108863 & o) + (67108863 & i);
								(i >>= 26),
									(i += (o / 67108864) | 0),
									(i += s >>> 26),
									(this.words[n] = 67108863 & s);
							}
							return 0 !== i && ((this.words[n] = i), this.length++), r ? this.ineg() : this;
						}),
						(o.prototype.muln = function (t) {
							return this.clone().imuln(t);
						}),
						(o.prototype.sqr = function () {
							return this.mul(this);
						}),
						(o.prototype.isqr = function () {
							return this.imul(this.clone());
						}),
						(o.prototype.pow = function (t) {
							var r = (function (t) {
								for (var r = new Array(t.bitLength()), i = 0; i < r.length; i++) {
									var e = (i / 26) | 0,
										n = i % 26;
									r[i] = (t.words[e] >>> n) & 1;
								}
								return r;
							})(t);
							if (0 === r.length) return new o(1);
							for (var i = this, e = 0; e < r.length && 0 === r[e]; e++, i = i.sqr());
							if (++e < r.length)
								for (var n = i.sqr(); e < r.length; e++, n = n.sqr()) 0 !== r[e] && (i = i.mul(n));
							return i;
						}),
						(o.prototype.iushln = function (t) {
							e('number' == typeof t && t >= 0);
							var r,
								i = t % 26,
								n = (t - i) / 26,
								o = (67108863 >>> (26 - i)) << (26 - i);
							if (0 !== i) {
								var s = 0;
								for (r = 0; r < this.length; r++) {
									var h = this.words[r] & o,
										u = ((0 | this.words[r]) - h) << i;
									(this.words[r] = u | s), (s = h >>> (26 - i));
								}
								s && ((this.words[r] = s), this.length++);
							}
							if (0 !== n) {
								for (r = this.length - 1; r >= 0; r--) this.words[r + n] = this.words[r];
								for (r = 0; r < n; r++) this.words[r] = 0;
								this.length += n;
							}
							return this._strip();
						}),
						(o.prototype.ishln = function (t) {
							return e(0 === this.negative), this.iushln(t);
						}),
						(o.prototype.iushrn = function (t, r, i) {
							var n;
							e('number' == typeof t && t >= 0), (n = r ? (r - (r % 26)) / 26 : 0);
							var o = t % 26,
								s = Math.min((t - o) / 26, this.length),
								h = 67108863 ^ ((67108863 >>> o) << o),
								u = i;
							if (((n -= s), (n = Math.max(0, n)), u)) {
								for (var a = 0; a < s; a++) u.words[a] = this.words[a];
								u.length = s;
							}
							if (0 === s);
							else if (this.length > s)
								for (this.length -= s, a = 0; a < this.length; a++)
									this.words[a] = this.words[a + s];
							else (this.words[0] = 0), (this.length = 1);
							var l = 0;
							for (a = this.length - 1; a >= 0 && (0 !== l || a >= n); a--) {
								var f = 0 | this.words[a];
								(this.words[a] = (l << (26 - o)) | (f >>> o)), (l = f & h);
							}
							return (
								u && 0 !== l && (u.words[u.length++] = l),
								0 === this.length && ((this.words[0] = 0), (this.length = 1)),
								this._strip()
							);
						}),
						(o.prototype.ishrn = function (t, r, i) {
							return e(0 === this.negative), this.iushrn(t, r, i);
						}),
						(o.prototype.shln = function (t) {
							return this.clone().ishln(t);
						}),
						(o.prototype.ushln = function (t) {
							return this.clone().iushln(t);
						}),
						(o.prototype.shrn = function (t) {
							return this.clone().ishrn(t);
						}),
						(o.prototype.ushrn = function (t) {
							return this.clone().iushrn(t);
						}),
						(o.prototype.testn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = t % 26,
								i = (t - r) / 26,
								n = 1 << r;
							return !(this.length <= i) && !!(this.words[i] & n);
						}),
						(o.prototype.imaskn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = t % 26,
								i = (t - r) / 26;
							if (
								(e(0 === this.negative, 'imaskn works only with positive numbers'),
								this.length <= i)
							)
								return this;
							if ((0 !== r && i++, (this.length = Math.min(i, this.length)), 0 !== r)) {
								var n = 67108863 ^ ((67108863 >>> r) << r);
								this.words[this.length - 1] &= n;
							}
							return this._strip();
						}),
						(o.prototype.maskn = function (t) {
							return this.clone().imaskn(t);
						}),
						(o.prototype.iaddn = function (t) {
							return (
								e('number' == typeof t),
								e(t < 67108864),
								t < 0
									? this.isubn(-t)
									: 0 !== this.negative
									? 1 === this.length && (0 | this.words[0]) <= t
										? ((this.words[0] = t - (0 | this.words[0])), (this.negative = 0), this)
										: ((this.negative = 0), this.isubn(t), (this.negative = 1), this)
									: this._iaddn(t)
							);
						}),
						(o.prototype._iaddn = function (t) {
							this.words[0] += t;
							for (var r = 0; r < this.length && this.words[r] >= 67108864; r++)
								(this.words[r] -= 67108864),
									r === this.length - 1 ? (this.words[r + 1] = 1) : this.words[r + 1]++;
							return (this.length = Math.max(this.length, r + 1)), this;
						}),
						(o.prototype.isubn = function (t) {
							if ((e('number' == typeof t), e(t < 67108864), t < 0)) return this.iaddn(-t);
							if (0 !== this.negative)
								return (this.negative = 0), this.iaddn(t), (this.negative = 1), this;
							if (((this.words[0] -= t), 1 === this.length && this.words[0] < 0))
								(this.words[0] = -this.words[0]), (this.negative = 1);
							else
								for (var r = 0; r < this.length && this.words[r] < 0; r++)
									(this.words[r] += 67108864), (this.words[r + 1] -= 1);
							return this._strip();
						}),
						(o.prototype.addn = function (t) {
							return this.clone().iaddn(t);
						}),
						(o.prototype.subn = function (t) {
							return this.clone().isubn(t);
						}),
						(o.prototype.iabs = function () {
							return (this.negative = 0), this;
						}),
						(o.prototype.abs = function () {
							return this.clone().iabs();
						}),
						(o.prototype._ishlnsubmul = function (t, r, i) {
							var n,
								o,
								s = t.length + i;
							this._expand(s);
							var h = 0;
							for (n = 0; n < t.length; n++) {
								o = (0 | this.words[n + i]) + h;
								var u = (0 | t.words[n]) * r;
								(h = ((o -= 67108863 & u) >> 26) - ((u / 67108864) | 0)),
									(this.words[n + i] = 67108863 & o);
							}
							for (; n < this.length - i; n++)
								(h = (o = (0 | this.words[n + i]) + h) >> 26), (this.words[n + i] = 67108863 & o);
							if (0 === h) return this._strip();
							for (e(-1 === h), h = 0, n = 0; n < this.length; n++)
								(h = (o = -(0 | this.words[n]) + h) >> 26), (this.words[n] = 67108863 & o);
							return (this.negative = 1), this._strip();
						}),
						(o.prototype._wordDiv = function (t, r) {
							var i = (this.length, t.length),
								e = this.clone(),
								n = t,
								s = 0 | n.words[n.length - 1];
							0 !== (i = 26 - this._countBits(s)) &&
								((n = n.ushln(i)), e.iushln(i), (s = 0 | n.words[n.length - 1]));
							var h,
								u = e.length - n.length;
							if ('mod' !== r) {
								((h = new o(null)).length = u + 1), (h.words = new Array(h.length));
								for (var a = 0; a < h.length; a++) h.words[a] = 0;
							}
							var l = e.clone()._ishlnsubmul(n, 1, u);
							0 === l.negative && ((e = l), h && (h.words[u] = 1));
							for (var f = u - 1; f >= 0; f--) {
								var m = 67108864 * (0 | e.words[n.length + f]) + (0 | e.words[n.length + f - 1]);
								for (
									m = Math.min((m / s) | 0, 67108863), e._ishlnsubmul(n, m, f);
									0 !== e.negative;

								)
									m--, (e.negative = 0), e._ishlnsubmul(n, 1, f), e.isZero() || (e.negative ^= 1);
								h && (h.words[f] = m);
							}
							return (
								h && h._strip(),
								e._strip(),
								'div' !== r && 0 !== i && e.iushrn(i),
								{ div: h || null, mod: e }
							);
						}),
						(o.prototype.divmod = function (t, r, i) {
							return (
								e(!t.isZero()),
								this.isZero()
									? { div: new o(0), mod: new o(0) }
									: 0 !== this.negative && 0 === t.negative
									? ((h = this.neg().divmod(t, r)),
									  'mod' !== r && (n = h.div.neg()),
									  'div' !== r && ((s = h.mod.neg()), i && 0 !== s.negative && s.iadd(t)),
									  { div: n, mod: s })
									: 0 === this.negative && 0 !== t.negative
									? ((h = this.divmod(t.neg(), r)),
									  'mod' !== r && (n = h.div.neg()),
									  { div: n, mod: h.mod })
									: 0 != (this.negative & t.negative)
									? ((h = this.neg().divmod(t.neg(), r)),
									  'div' !== r && ((s = h.mod.neg()), i && 0 !== s.negative && s.isub(t)),
									  { div: h.div, mod: s })
									: t.length > this.length || this.cmp(t) < 0
									? { div: new o(0), mod: this }
									: 1 === t.length
									? 'div' === r
										? { div: this.divn(t.words[0]), mod: null }
										: 'mod' === r
										? { div: null, mod: new o(this.modrn(t.words[0])) }
										: { div: this.divn(t.words[0]), mod: new o(this.modrn(t.words[0])) }
									: this._wordDiv(t, r)
							);
							var n, s, h;
						}),
						(o.prototype.div = function (t) {
							return this.divmod(t, 'div', !1).div;
						}),
						(o.prototype.mod = function (t) {
							return this.divmod(t, 'mod', !1).mod;
						}),
						(o.prototype.umod = function (t) {
							return this.divmod(t, 'mod', !0).mod;
						}),
						(o.prototype.divRound = function (t) {
							var r = this.divmod(t);
							if (r.mod.isZero()) return r.div;
							var i = 0 !== r.div.negative ? r.mod.isub(t) : r.mod,
								e = t.ushrn(1),
								n = t.andln(1),
								o = i.cmp(e);
							return o < 0 || (1 === n && 0 === o)
								? r.div
								: 0 !== r.div.negative
								? r.div.isubn(1)
								: r.div.iaddn(1);
						}),
						(o.prototype.modrn = function (t) {
							var r = t < 0;
							r && (t = -t), e(t <= 67108863);
							for (var i = (1 << 26) % t, n = 0, o = this.length - 1; o >= 0; o--)
								n = (i * n + (0 | this.words[o])) % t;
							return r ? -n : n;
						}),
						(o.prototype.modn = function (t) {
							return this.modrn(t);
						}),
						(o.prototype.idivn = function (t) {
							var r = t < 0;
							r && (t = -t), e(t <= 67108863);
							for (var i = 0, n = this.length - 1; n >= 0; n--) {
								var o = (0 | this.words[n]) + 67108864 * i;
								(this.words[n] = (o / t) | 0), (i = o % t);
							}
							return this._strip(), r ? this.ineg() : this;
						}),
						(o.prototype.divn = function (t) {
							return this.clone().idivn(t);
						}),
						(o.prototype.egcd = function (t) {
							e(0 === t.negative), e(!t.isZero());
							var r = this,
								i = t.clone();
							r = 0 !== r.negative ? r.umod(t) : r.clone();
							for (
								var n = new o(1), s = new o(0), h = new o(0), u = new o(1), a = 0;
								r.isEven() && i.isEven();

							)
								r.iushrn(1), i.iushrn(1), ++a;
							for (var l = i.clone(), f = r.clone(); !r.isZero(); ) {
								for (var m = 0, c = 1; 0 == (r.words[0] & c) && m < 26; ++m, c <<= 1);
								if (m > 0)
									for (r.iushrn(m); m-- > 0; )
										(n.isOdd() || s.isOdd()) && (n.iadd(l), s.isub(f)), n.iushrn(1), s.iushrn(1);
								for (var d = 0, p = 1; 0 == (i.words[0] & p) && d < 26; ++d, p <<= 1);
								if (d > 0)
									for (i.iushrn(d); d-- > 0; )
										(h.isOdd() || u.isOdd()) && (h.iadd(l), u.isub(f)), h.iushrn(1), u.iushrn(1);
								r.cmp(i) >= 0
									? (r.isub(i), n.isub(h), s.isub(u))
									: (i.isub(r), h.isub(n), u.isub(s));
							}
							return { a: h, b: u, gcd: i.iushln(a) };
						}),
						(o.prototype._invmp = function (t) {
							e(0 === t.negative), e(!t.isZero());
							var r = this,
								i = t.clone();
							r = 0 !== r.negative ? r.umod(t) : r.clone();
							for (
								var n, s = new o(1), h = new o(0), u = i.clone();
								r.cmpn(1) > 0 && i.cmpn(1) > 0;

							) {
								for (var a = 0, l = 1; 0 == (r.words[0] & l) && a < 26; ++a, l <<= 1);
								if (a > 0) for (r.iushrn(a); a-- > 0; ) s.isOdd() && s.iadd(u), s.iushrn(1);
								for (var f = 0, m = 1; 0 == (i.words[0] & m) && f < 26; ++f, m <<= 1);
								if (f > 0) for (i.iushrn(f); f-- > 0; ) h.isOdd() && h.iadd(u), h.iushrn(1);
								r.cmp(i) >= 0 ? (r.isub(i), s.isub(h)) : (i.isub(r), h.isub(s));
							}
							return (n = 0 === r.cmpn(1) ? s : h).cmpn(0) < 0 && n.iadd(t), n;
						}),
						(o.prototype.gcd = function (t) {
							if (this.isZero()) return t.abs();
							if (t.isZero()) return this.abs();
							var r = this.clone(),
								i = t.clone();
							(r.negative = 0), (i.negative = 0);
							for (var e = 0; r.isEven() && i.isEven(); e++) r.iushrn(1), i.iushrn(1);
							for (;;) {
								for (; r.isEven(); ) r.iushrn(1);
								for (; i.isEven(); ) i.iushrn(1);
								var n = r.cmp(i);
								if (n < 0) {
									var o = r;
									(r = i), (i = o);
								} else if (0 === n || 0 === i.cmpn(1)) break;
								r.isub(i);
							}
							return i.iushln(e);
						}),
						(o.prototype.invm = function (t) {
							return this.egcd(t).a.umod(t);
						}),
						(o.prototype.isEven = function () {
							return 0 == (1 & this.words[0]);
						}),
						(o.prototype.isOdd = function () {
							return 1 == (1 & this.words[0]);
						}),
						(o.prototype.andln = function (t) {
							return this.words[0] & t;
						}),
						(o.prototype.bincn = function (t) {
							e('number' == typeof t);
							var r = t % 26,
								i = (t - r) / 26,
								n = 1 << r;
							if (this.length <= i) return this._expand(i + 1), (this.words[i] |= n), this;
							for (var o = n, s = i; 0 !== o && s < this.length; s++) {
								var h = 0 | this.words[s];
								(o = (h += o) >>> 26), (h &= 67108863), (this.words[s] = h);
							}
							return 0 !== o && ((this.words[s] = o), this.length++), this;
						}),
						(o.prototype.isZero = function () {
							return 1 === this.length && 0 === this.words[0];
						}),
						(o.prototype.cmpn = function (t) {
							var r,
								i = t < 0;
							if (0 !== this.negative && !i) return -1;
							if (0 === this.negative && i) return 1;
							if ((this._strip(), this.length > 1)) r = 1;
							else {
								i && (t = -t), e(t <= 67108863, 'Number is too big');
								var n = 0 | this.words[0];
								r = n === t ? 0 : n < t ? -1 : 1;
							}
							return 0 !== this.negative ? 0 | -r : r;
						}),
						(o.prototype.cmp = function (t) {
							if (0 !== this.negative && 0 === t.negative) return -1;
							if (0 === this.negative && 0 !== t.negative) return 1;
							var r = this.ucmp(t);
							return 0 !== this.negative ? 0 | -r : r;
						}),
						(o.prototype.ucmp = function (t) {
							if (this.length > t.length) return 1;
							if (this.length < t.length) return -1;
							for (var r = 0, i = this.length - 1; i >= 0; i--) {
								var e = 0 | this.words[i],
									n = 0 | t.words[i];
								if (e !== n) {
									e < n ? (r = -1) : e > n && (r = 1);
									break;
								}
							}
							return r;
						}),
						(o.prototype.gtn = function (t) {
							return 1 === this.cmpn(t);
						}),
						(o.prototype.gt = function (t) {
							return 1 === this.cmp(t);
						}),
						(o.prototype.gten = function (t) {
							return this.cmpn(t) >= 0;
						}),
						(o.prototype.gte = function (t) {
							return this.cmp(t) >= 0;
						}),
						(o.prototype.ltn = function (t) {
							return -1 === this.cmpn(t);
						}),
						(o.prototype.lt = function (t) {
							return -1 === this.cmp(t);
						}),
						(o.prototype.lten = function (t) {
							return this.cmpn(t) <= 0;
						}),
						(o.prototype.lte = function (t) {
							return this.cmp(t) <= 0;
						}),
						(o.prototype.eqn = function (t) {
							return 0 === this.cmpn(t);
						}),
						(o.prototype.eq = function (t) {
							return 0 === this.cmp(t);
						}),
						(o.red = function (t) {
							return new S(t);
						}),
						(o.prototype.toRed = function (t) {
							return (
								e(!this.red, 'Already a number in reduction context'),
								e(0 === this.negative, 'red works only with positives'),
								t.convertTo(this)._forceRed(t)
							);
						}),
						(o.prototype.fromRed = function () {
							return (
								e(this.red, 'fromRed works only with numbers in reduction context'),
								this.red.convertFrom(this)
							);
						}),
						(o.prototype._forceRed = function (t) {
							return (this.red = t), this;
						}),
						(o.prototype.forceRed = function (t) {
							return e(!this.red, 'Already a number in reduction context'), this._forceRed(t);
						}),
						(o.prototype.redAdd = function (t) {
							return e(this.red, 'redAdd works only with red numbers'), this.red.add(this, t);
						}),
						(o.prototype.redIAdd = function (t) {
							return e(this.red, 'redIAdd works only with red numbers'), this.red.iadd(this, t);
						}),
						(o.prototype.redSub = function (t) {
							return e(this.red, 'redSub works only with red numbers'), this.red.sub(this, t);
						}),
						(o.prototype.redISub = function (t) {
							return e(this.red, 'redISub works only with red numbers'), this.red.isub(this, t);
						}),
						(o.prototype.redShl = function (t) {
							return e(this.red, 'redShl works only with red numbers'), this.red.shl(this, t);
						}),
						(o.prototype.redMul = function (t) {
							return (
								e(this.red, 'redMul works only with red numbers'),
								this.red._verify2(this, t),
								this.red.mul(this, t)
							);
						}),
						(o.prototype.redIMul = function (t) {
							return (
								e(this.red, 'redMul works only with red numbers'),
								this.red._verify2(this, t),
								this.red.imul(this, t)
							);
						}),
						(o.prototype.redSqr = function () {
							return (
								e(this.red, 'redSqr works only with red numbers'),
								this.red._verify1(this),
								this.red.sqr(this)
							);
						}),
						(o.prototype.redISqr = function () {
							return (
								e(this.red, 'redISqr works only with red numbers'),
								this.red._verify1(this),
								this.red.isqr(this)
							);
						}),
						(o.prototype.redSqrt = function () {
							return (
								e(this.red, 'redSqrt works only with red numbers'),
								this.red._verify1(this),
								this.red.sqrt(this)
							);
						}),
						(o.prototype.redInvm = function () {
							return (
								e(this.red, 'redInvm works only with red numbers'),
								this.red._verify1(this),
								this.red.invm(this)
							);
						}),
						(o.prototype.redNeg = function () {
							return (
								e(this.red, 'redNeg works only with red numbers'),
								this.red._verify1(this),
								this.red.neg(this)
							);
						}),
						(o.prototype.redPow = function (t) {
							return (
								e(this.red && !t.red, 'redPow(normalNum)'),
								this.red._verify1(this),
								this.red.pow(this, t)
							);
						});
					var M = { k256: null, p224: null, p192: null, p25519: null };
					function b(t, r) {
						(this.name = t),
							(this.p = new o(r, 16)),
							(this.n = this.p.bitLength()),
							(this.k = new o(1).iushln(this.n).isub(this.p)),
							(this.tmp = this._tmp());
					}
					function _() {
						b.call(
							this,
							'k256',
							'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f'
						);
					}
					function A() {
						b.call(this, 'p224', 'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001');
					}
					function E() {
						b.call(this, 'p192', 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff');
					}
					function x() {
						b.call(
							this,
							'25519',
							'7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed'
						);
					}
					function S(t) {
						if ('string' == typeof t) {
							var r = o._prime(t);
							(this.m = r.p), (this.prime = r);
						} else e(t.gtn(1), 'modulus must be greater than 1'), (this.m = t), (this.prime = null);
					}
					function N(t) {
						S.call(this, t),
							(this.shift = this.m.bitLength()),
							this.shift % 26 != 0 && (this.shift += 26 - (this.shift % 26)),
							(this.r = new o(1).iushln(this.shift)),
							(this.r2 = this.imod(this.r.sqr())),
							(this.rinv = this.r._invmp(this.m)),
							(this.minv = this.rinv.mul(this.r).isubn(1).div(this.m)),
							(this.minv = this.minv.umod(this.r)),
							(this.minv = this.r.sub(this.minv));
					}
					(b.prototype._tmp = function () {
						var t = new o(null);
						return (t.words = new Array(Math.ceil(this.n / 13))), t;
					}),
						(b.prototype.ireduce = function (t) {
							var r,
								i = t;
							do {
								this.split(i, this.tmp), (r = (i = (i = this.imulK(i)).iadd(this.tmp)).bitLength());
							} while (r > this.n);
							var e = r < this.n ? -1 : i.ucmp(this.p);
							return (
								0 === e
									? ((i.words[0] = 0), (i.length = 1))
									: e > 0
									? i.isub(this.p)
									: void 0 !== i.strip
									? i.strip()
									: i._strip(),
								i
							);
						}),
						(b.prototype.split = function (t, r) {
							t.iushrn(this.n, 0, r);
						}),
						(b.prototype.imulK = function (t) {
							return t.imul(this.k);
						}),
						n(_, b),
						(_.prototype.split = function (t, r) {
							for (var i = Math.min(t.length, 9), e = 0; e < i; e++) r.words[e] = t.words[e];
							if (((r.length = i), t.length <= 9)) return (t.words[0] = 0), void (t.length = 1);
							var n = t.words[9];
							for (r.words[r.length++] = 4194303 & n, e = 10; e < t.length; e++) {
								var o = 0 | t.words[e];
								(t.words[e - 10] = ((4194303 & o) << 4) | (n >>> 22)), (n = o);
							}
							(n >>>= 22),
								(t.words[e - 10] = n),
								0 === n && t.length > 10 ? (t.length -= 10) : (t.length -= 9);
						}),
						(_.prototype.imulK = function (t) {
							(t.words[t.length] = 0), (t.words[t.length + 1] = 0), (t.length += 2);
							for (var r = 0, i = 0; i < t.length; i++) {
								var e = 0 | t.words[i];
								(r += 977 * e), (t.words[i] = 67108863 & r), (r = 64 * e + ((r / 67108864) | 0));
							}
							return (
								0 === t.words[t.length - 1] &&
									(t.length--, 0 === t.words[t.length - 1] && t.length--),
								t
							);
						}),
						n(A, b),
						n(E, b),
						n(x, b),
						(x.prototype.imulK = function (t) {
							for (var r = 0, i = 0; i < t.length; i++) {
								var e = 19 * (0 | t.words[i]) + r,
									n = 67108863 & e;
								(e >>>= 26), (t.words[i] = n), (r = e);
							}
							return 0 !== r && (t.words[t.length++] = r), t;
						}),
						(o._prime = function (t) {
							if (M[t]) return M[t];
							var r;
							if ('k256' === t) r = new _();
							else if ('p224' === t) r = new A();
							else if ('p192' === t) r = new E();
							else {
								if ('p25519' !== t) throw new Error('Unknown prime ' + t);
								r = new x();
							}
							return (M[t] = r), r;
						}),
						(S.prototype._verify1 = function (t) {
							e(0 === t.negative, 'red works only with positives'),
								e(t.red, 'red works only with red numbers');
						}),
						(S.prototype._verify2 = function (t, r) {
							e(0 == (t.negative | r.negative), 'red works only with positives'),
								e(t.red && t.red === r.red, 'red works only with red numbers');
						}),
						(S.prototype.imod = function (t) {
							return this.prime
								? this.prime.ireduce(t)._forceRed(this)
								: (l(t, t.umod(this.m)._forceRed(this)), t);
						}),
						(S.prototype.neg = function (t) {
							return t.isZero() ? t.clone() : this.m.sub(t)._forceRed(this);
						}),
						(S.prototype.add = function (t, r) {
							this._verify2(t, r);
							var i = t.add(r);
							return i.cmp(this.m) >= 0 && i.isub(this.m), i._forceRed(this);
						}),
						(S.prototype.iadd = function (t, r) {
							this._verify2(t, r);
							var i = t.iadd(r);
							return i.cmp(this.m) >= 0 && i.isub(this.m), i;
						}),
						(S.prototype.sub = function (t, r) {
							this._verify2(t, r);
							var i = t.sub(r);
							return i.cmpn(0) < 0 && i.iadd(this.m), i._forceRed(this);
						}),
						(S.prototype.isub = function (t, r) {
							this._verify2(t, r);
							var i = t.isub(r);
							return i.cmpn(0) < 0 && i.iadd(this.m), i;
						}),
						(S.prototype.shl = function (t, r) {
							return this._verify1(t), this.imod(t.ushln(r));
						}),
						(S.prototype.imul = function (t, r) {
							return this._verify2(t, r), this.imod(t.imul(r));
						}),
						(S.prototype.mul = function (t, r) {
							return this._verify2(t, r), this.imod(t.mul(r));
						}),
						(S.prototype.isqr = function (t) {
							return this.imul(t, t.clone());
						}),
						(S.prototype.sqr = function (t) {
							return this.mul(t, t);
						}),
						(S.prototype.sqrt = function (t) {
							if (t.isZero()) return t.clone();
							var r = this.m.andln(3);
							if ((e(r % 2 == 1), 3 === r)) {
								var i = this.m.add(new o(1)).iushrn(2);
								return this.pow(t, i);
							}
							for (var n = this.m.subn(1), s = 0; !n.isZero() && 0 === n.andln(1); )
								s++, n.iushrn(1);
							e(!n.isZero());
							var h = new o(1).toRed(this),
								u = h.redNeg(),
								a = this.m.subn(1).iushrn(1),
								l = this.m.bitLength();
							for (l = new o(2 * l * l).toRed(this); 0 !== this.pow(l, a).cmp(u); ) l.redIAdd(u);
							for (
								var f = this.pow(l, n),
									m = this.pow(t, n.addn(1).iushrn(1)),
									c = this.pow(t, n),
									d = s;
								0 !== c.cmp(h);

							) {
								for (var p = c, g = 0; 0 !== p.cmp(h); g++) p = p.redSqr();
								e(g < d);
								var v = this.pow(f, new o(1).iushln(d - g - 1));
								(m = m.redMul(v)), (f = v.redSqr()), (c = c.redMul(f)), (d = g);
							}
							return m;
						}),
						(S.prototype.invm = function (t) {
							var r = t._invmp(this.m);
							return 0 !== r.negative ? ((r.negative = 0), this.imod(r).redNeg()) : this.imod(r);
						}),
						(S.prototype.pow = function (t, r) {
							if (r.isZero()) return new o(1).toRed(this);
							if (0 === r.cmpn(1)) return t.clone();
							var i = new Array(16);
							(i[0] = new o(1).toRed(this)), (i[1] = t);
							for (var e = 2; e < i.length; e++) i[e] = this.mul(i[e - 1], t);
							var n = i[0],
								s = 0,
								h = 0,
								u = r.bitLength() % 26;
							for (0 === u && (u = 26), e = r.length - 1; e >= 0; e--) {
								for (var a = r.words[e], l = u - 1; l >= 0; l--) {
									var f = (a >> l) & 1;
									n !== i[0] && (n = this.sqr(n)),
										0 !== f || 0 !== s
											? ((s <<= 1),
											  (s |= f),
											  (4 === ++h || (0 === e && 0 === l)) &&
													((n = this.mul(n, i[s])), (h = 0), (s = 0)))
											: (h = 0);
								}
								u = 26;
							}
							return n;
						}),
						(S.prototype.convertTo = function (t) {
							var r = t.umod(this.m);
							return r === t ? r.clone() : r;
						}),
						(S.prototype.convertFrom = function (t) {
							var r = t.clone();
							return (r.red = null), r;
						}),
						(o.mont = function (t) {
							return new N(t);
						}),
						n(N, S),
						(N.prototype.convertTo = function (t) {
							return this.imod(t.ushln(this.shift));
						}),
						(N.prototype.convertFrom = function (t) {
							var r = this.imod(t.mul(this.rinv));
							return (r.red = null), r;
						}),
						(N.prototype.imul = function (t, r) {
							if (t.isZero() || r.isZero()) return (t.words[0] = 0), (t.length = 1), t;
							var i = t.imul(r),
								e = i.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
								n = i.isub(e).iushrn(this.shift),
								o = n;
							return (
								n.cmp(this.m) >= 0 ? (o = n.isub(this.m)) : n.cmpn(0) < 0 && (o = n.iadd(this.m)),
								o._forceRed(this)
							);
						}),
						(N.prototype.mul = function (t, r) {
							if (t.isZero() || r.isZero()) return new o(0)._forceRed(this);
							var i = t.mul(r),
								e = i.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
								n = i.isub(e).iushrn(this.shift),
								s = n;
							return (
								n.cmp(this.m) >= 0 ? (s = n.isub(this.m)) : n.cmpn(0) < 0 && (s = n.iadd(this.m)),
								s._forceRed(this)
							);
						}),
						(N.prototype.invm = function (t) {
							return this.imod(t._invmp(this.m).mul(this.r2))._forceRed(this);
						});
				})(t, this);
			}.call(this, i(0)(t)));
		},
		function (t, r, i) {
			'use strict';
			(function (r) {
				const e = i(8),
					n = i(34),
					o = Object.entries({
						1: { network: 'mainnet' },
						3: { network: 'ropsten' },
						31337: { network: 'mainnet', fork: !0 },
					}).reduce((t, [r, i]) => ((t[r] = Object.assign({ useOvm: !1, fork: !1 }, i)), t), {}),
					s = Object.entries(o).reduce(
						(t, [r, { network: i, useOvm: e, fork: n }]) => (
							(t[i + (e ? '-ovm' : '') + (n ? '-fork' : '')] = r), t
						),
						{}
					),
					h = {
						BUILD_FOLDER: 'build',
						CONTRACTS_FOLDER: 'contracts',
						COMPILED_FOLDER: 'compiled',
						FLATTENED_FOLDER: 'flattened',
						AST_FOLDER: 'ast',
						CONFIG_FILENAME: 'config.json',
						PARAMS_FILENAME: 'params.json',
						SYNTHS_FILENAME: 'synths.json',
						STAKING_REWARDS_FILENAME: 'rewards.json',
						SHORTING_REWARDS_FILENAME: 'shorting-rewards.json',
						OWNER_ACTIONS_FILENAME: 'owner-actions.json',
						DEPLOYMENT_FILENAME: 'deployment.json',
						VERSIONS_FILENAME: 'versions.json',
						FEEDS_FILENAME: 'feeds.json',
						AST_FILENAME: 'asts.json',
						ZERO_ADDRESS: '0x' + '0'.repeat(40),
						ZERO_BYTES32: '0x' + '0'.repeat(64),
						OVM_MAX_GAS_LIMIT: '8999999',
						inflationStartTimestampInSecs: 1551830400,
					},
					u = {
						WAITING_PERIOD_SECS: (300).toString(),
						PRICE_DEVIATION_THRESHOLD_FACTOR: e.toWei('3'),
						TRADING_REWARDS_ENABLED: !1,
						ISSUANCE_RATIO: e.toBN(1).mul(e.toBN(1e18)).div(e.toBN(6)).toString(),
						FEE_PERIOD_DURATION: (604800).toString(),
						TARGET_THRESHOLD: '1',
						LIQUIDATION_DELAY: (259200).toString(),
						LIQUIDATION_RATIO: e.toWei('0.5'),
						LIQUIDATION_PENALTY: e.toWei('0.1'),
						RATE_STALE_PERIOD: (9e4).toString(),
						EXCHANGE_FEE_RATES: {
							forex: e.toWei('0.003'),
							commodity: e.toWei('0.003'),
							equities: e.toWei('0.003'),
							crypto: e.toWei('0.01'),
							index: e.toWei('0.01'),
						},
						MINIMUM_STAKE_TIME: (86400).toString(),
						DEBT_SNAPSHOT_STALE_TIME: (43800).toString(),
						AGGREGATOR_WARNING_FLAGS: {
							mainnet: '0x4A5b9B4aD08616D11F3A402FF7cBEAcB732a76C6',
							kovan: '0x6292aa9a6650ae14fbf974e5029f36f95a1848fd',
						},
						RENBTC_ERC20_ADDRESSES: {
							mainnet: '0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D',
							kovan: '0x9B2fE385cEDea62D839E4dE89B0A23EF4eacC717',
							rinkeby: '0xEDC0C23864B041607D624E2d9a67916B6cf40F7a',
						},
						INITIAL_ISSUANCE: e.toWei('100000000'),
						CROSS_DOMAIN_DEPOSIT_GAS_LIMIT: '3000000',
						CROSS_DOMAIN_ESCROW_GAS_LIMIT: '8000000',
						CROSS_DOMAIN_REWARD_GAS_LIMIT: '3000000',
						CROSS_DOMAIN_WITHDRAWAL_GAS_LIMIT: '3000000',
						COLLATERAL_MANAGER: {
							SYNTHS: ['sUSD', 'sBTC', 'sETH'],
							SHORTS: [
								{ long: 'sBTC', short: 'iBTC' },
								{ long: 'sETH', short: 'iETH' },
							],
							MAX_DEBT: e.toWei('75000000'),
							BASE_BORROW_RATE: Math.round(158443823.07706398).toString(),
							BASE_SHORT_RATE: Math.round(158443823.07706398).toString(),
						},
						COLLATERAL_ETH: {
							SYNTHS: ['sUSD', 'sETH'],
							MIN_CRATIO: e.toWei('1.3'),
							MIN_COLLATERAL: e.toWei('2'),
							ISSUE_FEE_RATE: e.toWei('0.001'),
						},
						COLLATERAL_RENBTC: {
							SYNTHS: ['sUSD', 'sBTC'],
							MIN_CRATIO: e.toWei('1.3'),
							MIN_COLLATERAL: e.toWei('0.05'),
							ISSUE_FEE_RATE: e.toWei('0.001'),
						},
						COLLATERAL_SHORT: {
							SYNTHS: ['sBTC', 'sETH'],
							MIN_CRATIO: e.toWei('1.2'),
							MIN_COLLATERAL: e.toWei('1000'),
							ISSUE_FEE_RATE: e.toWei('0.005'),
							INTERACTION_DELAY: '3600',
						},
					},
					a = ({ network: t, useOvm: r = !1 }) => (t.includes('ovm') ? t : r ? t + '-ovm' : t),
					l = ({
						network: t = 'mainnet',
						useOvm: r = !1,
						contract: i,
						path: e,
						fs: n,
						deploymentPath: o,
					} = {}) => {
						const s = loadDeploymentFile({
							network: t,
							useOvm: r,
							path: e,
							fs: n,
							deploymentPath: o,
						});
						return i ? s.targets[i] : s.targets;
					},
					f = ({
						network: t = 'mainnet',
						useOvm: r = !1,
						contract: i,
						path: e,
						fs: n,
						deploymentPath: o,
					} = {}) => {
						const s = loadDeploymentFile({
							network: t,
							useOvm: r,
							path: e,
							fs: n,
							deploymentPath: o,
						});
						return i ? s.sources[i] : s.sources;
					};
				t.exports = {
					chainIdMapping: o,
					constants: h,
					decode: ({
						network: t = 'mainnet',
						fs: r,
						path: i,
						data: e,
						target: o,
						useOvm: s = !1,
					} = {}) => {
						const h = f({ network: t, path: i, fs: r, useOvm: s });
						for (const { abi: t } of Object.values(h)) n.addABI(t);
						const u = l({ network: t, path: i, fs: r, useOvm: s });
						let a;
						return (
							o &&
								(a = Object.values(u).filter(
									({ address: t }) => t.toLowerCase() === o.toLowerCase()
								)[0].name),
							{ method: n.decodeMethod(e), contract: a }
						);
					},
					defaults: u,
					getNetworkFromId: ({ id: t }) => o[t],
					getPathToNetwork: ({
						network: t = 'mainnet',
						file: i = '',
						useOvm: e = !1,
						path: n,
					} = {}) => n.join(r, 'publish', 'deployed', a({ network: t, useOvm: e }), i),
					getSource: f,
					getTarget: l,
					getUsers: ({ network: t = 'mainnet', user: r, useOvm: i = !1 } = {}) => {
						const e = '0x73570075092502472e4b61a7058df1a4a1db12f2',
							n = {
								owner: e,
								deployer: e,
								marketClosure: e,
								oracle: '0xac1e8B385230970319906C03A1d8567e3996d1d5',
								fee: '0xfeEFEEfeefEeFeefEEFEEfEeFeefEEFeeFEEFEeF',
								zero: '0x' + '0'.repeat(40),
							},
							o = {
								mainnet: Object.assign({}, n, {
									owner: '0xEb3107117FEAd7de89Cd14D463D340A2E6917769',
									deployer: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
									marketClosure: '0xC105Ea57Eb434Fbe44690d7Dec2702e4a2FBFCf7',
									oracle: '0xaC1ED4Fabbd5204E02950D68b6FC8c446AC95362',
								}),
								kovan: Object.assign({}, n),
								'kovan-ovm': Object.assign({}, n),
								'mainnet-ovm': Object.assign({}, n, {
									owner: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
								}),
								rinkeby: Object.assign({}, n),
								ropsten: Object.assign({}, n),
								goerli: Object.assign({}, n),
								'goerli-ovm': Object.assign({}, n),
								local: Object.assign({}, n, {
									owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
								}),
							},
							s = Object.entries(o[a({ network: t, useOvm: i })]).map(([t, r]) => ({
								name: t,
								address: r,
							}));
						return r ? s.find(({ name: t }) => t === r) : s;
					},
					networks: ['local', 'ropsten', 'mainnet'],
					networkToChainId: s,
					toBytes32: (t) => e.rightPad(e.asciiToHex(t), 64),
					fromBytes32: (t) => e.hexToAscii(t),
					wrap: ({ network: r, deploymentPath: i, fs: e, path: n, useOvm: o = !1 }) =>
						[
							'decode',
							'getAST',
							'getPathToNetwork',
							'getSource',
							'getStakingRewards',
							'getShortingRewards',
							'getFeeds',
							'getSynths',
							'getTarget',
							'getTokens',
							'getUsers',
							'getVersions',
						].reduce(
							(s, h) => (
								(s[h] = (s = {}) =>
									t.exports[h](
										Object.assign({ network: r, deploymentPath: i, fs: e, path: n, useOvm: o }, s)
									)),
								s
							),
							{}
						),
					knownAccounts: {
						mainnet: [
							{ name: 'binance', address: '0xF977814e90dA44bFA03b6295A0616a897441aceC' },
							{ name: 'renBTCWallet', address: '0x35ffd6e268610e764ff6944d07760d0efe5e40e5' },
							{ name: 'loansAccount', address: '0x62f7A1F94aba23eD2dD108F8D23Aa3e7d452565B' },
						],
						rinkeby: [],
						kovan: [],
					},
				};
			}.call(this, '/'));
		},
		,
		function (t, r, i) {
			(function (t) {
				!(function (t, r) {
					'use strict';
					function e(t, r) {
						if (!t) throw new Error(r || 'Assertion failed');
					}
					function n(t, r) {
						t.super_ = r;
						var i = function () {};
						(i.prototype = r.prototype), (t.prototype = new i()), (t.prototype.constructor = t);
					}
					function o(t, r, i) {
						if (o.isBN(t)) return t;
						(this.negative = 0),
							(this.words = null),
							(this.length = 0),
							(this.red = null),
							null !== t &&
								(('le' !== r && 'be' !== r) || ((i = r), (r = 10)),
								this._init(t || 0, r || 10, i || 'be'));
					}
					var s;
					'object' == typeof t ? (t.exports = o) : (r.BN = o), (o.BN = o), (o.wordSize = 26);
					try {
						s = i(1).Buffer;
					} catch (t) {}
					function h(t, r, i) {
						for (var e = 0, n = Math.min(t.length, i), o = r; o < n; o++) {
							var s = t.charCodeAt(o) - 48;
							(e <<= 4),
								(e |= s >= 49 && s <= 54 ? s - 49 + 10 : s >= 17 && s <= 22 ? s - 17 + 10 : 15 & s);
						}
						return e;
					}
					function u(t, r, i, e) {
						for (var n = 0, o = Math.min(t.length, i), s = r; s < o; s++) {
							var h = t.charCodeAt(s) - 48;
							(n *= e), (n += h >= 49 ? h - 49 + 10 : h >= 17 ? h - 17 + 10 : h);
						}
						return n;
					}
					(o.isBN = function (t) {
						return (
							t instanceof o ||
							(null !== t &&
								'object' == typeof t &&
								t.constructor.wordSize === o.wordSize &&
								Array.isArray(t.words))
						);
					}),
						(o.max = function (t, r) {
							return t.cmp(r) > 0 ? t : r;
						}),
						(o.min = function (t, r) {
							return t.cmp(r) < 0 ? t : r;
						}),
						(o.prototype._init = function (t, r, i) {
							if ('number' == typeof t) return this._initNumber(t, r, i);
							if ('object' == typeof t) return this._initArray(t, r, i);
							'hex' === r && (r = 16), e(r === (0 | r) && r >= 2 && r <= 36);
							var n = 0;
							'-' === (t = t.toString().replace(/\s+/g, ''))[0] && n++,
								16 === r ? this._parseHex(t, n) : this._parseBase(t, r, n),
								'-' === t[0] && (this.negative = 1),
								this.strip(),
								'le' === i && this._initArray(this.toArray(), r, i);
						}),
						(o.prototype._initNumber = function (t, r, i) {
							t < 0 && ((this.negative = 1), (t = -t)),
								t < 67108864
									? ((this.words = [67108863 & t]), (this.length = 1))
									: t < 4503599627370496
									? ((this.words = [67108863 & t, (t / 67108864) & 67108863]), (this.length = 2))
									: (e(t < 9007199254740992),
									  (this.words = [67108863 & t, (t / 67108864) & 67108863, 1]),
									  (this.length = 3)),
								'le' === i && this._initArray(this.toArray(), r, i);
						}),
						(o.prototype._initArray = function (t, r, i) {
							if ((e('number' == typeof t.length), t.length <= 0))
								return (this.words = [0]), (this.length = 1), this;
							(this.length = Math.ceil(t.length / 3)), (this.words = new Array(this.length));
							for (var n = 0; n < this.length; n++) this.words[n] = 0;
							var o,
								s,
								h = 0;
							if ('be' === i)
								for (n = t.length - 1, o = 0; n >= 0; n -= 3)
									(s = t[n] | (t[n - 1] << 8) | (t[n - 2] << 16)),
										(this.words[o] |= (s << h) & 67108863),
										(this.words[o + 1] = (s >>> (26 - h)) & 67108863),
										(h += 24) >= 26 && ((h -= 26), o++);
							else if ('le' === i)
								for (n = 0, o = 0; n < t.length; n += 3)
									(s = t[n] | (t[n + 1] << 8) | (t[n + 2] << 16)),
										(this.words[o] |= (s << h) & 67108863),
										(this.words[o + 1] = (s >>> (26 - h)) & 67108863),
										(h += 24) >= 26 && ((h -= 26), o++);
							return this.strip();
						}),
						(o.prototype._parseHex = function (t, r) {
							(this.length = Math.ceil((t.length - r) / 6)), (this.words = new Array(this.length));
							for (var i = 0; i < this.length; i++) this.words[i] = 0;
							var e,
								n,
								o = 0;
							for (i = t.length - 6, e = 0; i >= r; i -= 6)
								(n = h(t, i, i + 6)),
									(this.words[e] |= (n << o) & 67108863),
									(this.words[e + 1] |= (n >>> (26 - o)) & 4194303),
									(o += 24) >= 26 && ((o -= 26), e++);
							i + 6 !== r &&
								((n = h(t, r, i + 6)),
								(this.words[e] |= (n << o) & 67108863),
								(this.words[e + 1] |= (n >>> (26 - o)) & 4194303)),
								this.strip();
						}),
						(o.prototype._parseBase = function (t, r, i) {
							(this.words = [0]), (this.length = 1);
							for (var e = 0, n = 1; n <= 67108863; n *= r) e++;
							e--, (n = (n / r) | 0);
							for (
								var o = t.length - i, s = o % e, h = Math.min(o, o - s) + i, a = 0, l = i;
								l < h;
								l += e
							)
								(a = u(t, l, l + e, r)),
									this.imuln(n),
									this.words[0] + a < 67108864 ? (this.words[0] += a) : this._iaddn(a);
							if (0 !== s) {
								var f = 1;
								for (a = u(t, l, t.length, r), l = 0; l < s; l++) f *= r;
								this.imuln(f), this.words[0] + a < 67108864 ? (this.words[0] += a) : this._iaddn(a);
							}
						}),
						(o.prototype.copy = function (t) {
							t.words = new Array(this.length);
							for (var r = 0; r < this.length; r++) t.words[r] = this.words[r];
							(t.length = this.length), (t.negative = this.negative), (t.red = this.red);
						}),
						(o.prototype.clone = function () {
							var t = new o(null);
							return this.copy(t), t;
						}),
						(o.prototype._expand = function (t) {
							for (; this.length < t; ) this.words[this.length++] = 0;
							return this;
						}),
						(o.prototype.strip = function () {
							for (; this.length > 1 && 0 === this.words[this.length - 1]; ) this.length--;
							return this._normSign();
						}),
						(o.prototype._normSign = function () {
							return 1 === this.length && 0 === this.words[0] && (this.negative = 0), this;
						}),
						(o.prototype.inspect = function () {
							return (this.red ? '<BN-R: ' : '<BN: ') + this.toString(16) + '>';
						});
					var a = [
							'',
							'0',
							'00',
							'000',
							'0000',
							'00000',
							'000000',
							'0000000',
							'00000000',
							'000000000',
							'0000000000',
							'00000000000',
							'000000000000',
							'0000000000000',
							'00000000000000',
							'000000000000000',
							'0000000000000000',
							'00000000000000000',
							'000000000000000000',
							'0000000000000000000',
							'00000000000000000000',
							'000000000000000000000',
							'0000000000000000000000',
							'00000000000000000000000',
							'000000000000000000000000',
							'0000000000000000000000000',
						],
						l = [
							0, 0, 25, 16, 12, 11, 10, 9, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5,
							5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
						],
						f = [
							0, 0, 33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216, 43046721,
							1e7, 19487171, 35831808, 62748517, 7529536, 11390625, 16777216, 24137569, 34012224,
							47045881, 64e6, 4084101, 5153632, 6436343, 7962624, 9765625, 11881376, 14348907,
							17210368, 20511149, 243e5, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176,
						];
					function m(t, r, i) {
						i.negative = r.negative ^ t.negative;
						var e = (t.length + r.length) | 0;
						(i.length = e), (e = (e - 1) | 0);
						var n = 0 | t.words[0],
							o = 0 | r.words[0],
							s = n * o,
							h = 67108863 & s,
							u = (s / 67108864) | 0;
						i.words[0] = h;
						for (var a = 1; a < e; a++) {
							for (
								var l = u >>> 26,
									f = 67108863 & u,
									m = Math.min(a, r.length - 1),
									c = Math.max(0, a - t.length + 1);
								c <= m;
								c++
							) {
								var d = (a - c) | 0;
								(l += ((s = (n = 0 | t.words[d]) * (o = 0 | r.words[c]) + f) / 67108864) | 0),
									(f = 67108863 & s);
							}
							(i.words[a] = 0 | f), (u = 0 | l);
						}
						return 0 !== u ? (i.words[a] = 0 | u) : i.length--, i.strip();
					}
					(o.prototype.toString = function (t, r) {
						var i;
						if (((r = 0 | r || 1), 16 === (t = t || 10) || 'hex' === t)) {
							i = '';
							for (var n = 0, o = 0, s = 0; s < this.length; s++) {
								var h = this.words[s],
									u = (16777215 & ((h << n) | o)).toString(16);
								(i =
									0 !== (o = (h >>> (24 - n)) & 16777215) || s !== this.length - 1
										? a[6 - u.length] + u + i
										: u + i),
									(n += 2) >= 26 && ((n -= 26), s--);
							}
							for (0 !== o && (i = o.toString(16) + i); i.length % r != 0; ) i = '0' + i;
							return 0 !== this.negative && (i = '-' + i), i;
						}
						if (t === (0 | t) && t >= 2 && t <= 36) {
							var m = l[t],
								c = f[t];
							i = '';
							var d = this.clone();
							for (d.negative = 0; !d.isZero(); ) {
								var p = d.modn(c).toString(t);
								i = (d = d.idivn(c)).isZero() ? p + i : a[m - p.length] + p + i;
							}
							for (this.isZero() && (i = '0' + i); i.length % r != 0; ) i = '0' + i;
							return 0 !== this.negative && (i = '-' + i), i;
						}
						e(!1, 'Base should be between 2 and 36');
					}),
						(o.prototype.toNumber = function () {
							var t = this.words[0];
							return (
								2 === this.length
									? (t += 67108864 * this.words[1])
									: 3 === this.length && 1 === this.words[2]
									? (t += 4503599627370496 + 67108864 * this.words[1])
									: this.length > 2 && e(!1, 'Number can only safely store up to 53 bits'),
								0 !== this.negative ? -t : t
							);
						}),
						(o.prototype.toJSON = function () {
							return this.toString(16);
						}),
						(o.prototype.toBuffer = function (t, r) {
							return e(void 0 !== s), this.toArrayLike(s, t, r);
						}),
						(o.prototype.toArray = function (t, r) {
							return this.toArrayLike(Array, t, r);
						}),
						(o.prototype.toArrayLike = function (t, r, i) {
							var n = this.byteLength(),
								o = i || Math.max(1, n);
							e(n <= o, 'byte array longer than desired length'),
								e(o > 0, 'Requested array length <= 0'),
								this.strip();
							var s,
								h,
								u = 'le' === r,
								a = new t(o),
								l = this.clone();
							if (u) {
								for (h = 0; !l.isZero(); h++) (s = l.andln(255)), l.iushrn(8), (a[h] = s);
								for (; h < o; h++) a[h] = 0;
							} else {
								for (h = 0; h < o - n; h++) a[h] = 0;
								for (h = 0; !l.isZero(); h++) (s = l.andln(255)), l.iushrn(8), (a[o - h - 1] = s);
							}
							return a;
						}),
						Math.clz32
							? (o.prototype._countBits = function (t) {
									return 32 - Math.clz32(t);
							  })
							: (o.prototype._countBits = function (t) {
									var r = t,
										i = 0;
									return (
										r >= 4096 && ((i += 13), (r >>>= 13)),
										r >= 64 && ((i += 7), (r >>>= 7)),
										r >= 8 && ((i += 4), (r >>>= 4)),
										r >= 2 && ((i += 2), (r >>>= 2)),
										i + r
									);
							  }),
						(o.prototype._zeroBits = function (t) {
							if (0 === t) return 26;
							var r = t,
								i = 0;
							return (
								0 == (8191 & r) && ((i += 13), (r >>>= 13)),
								0 == (127 & r) && ((i += 7), (r >>>= 7)),
								0 == (15 & r) && ((i += 4), (r >>>= 4)),
								0 == (3 & r) && ((i += 2), (r >>>= 2)),
								0 == (1 & r) && i++,
								i
							);
						}),
						(o.prototype.bitLength = function () {
							var t = this.words[this.length - 1],
								r = this._countBits(t);
							return 26 * (this.length - 1) + r;
						}),
						(o.prototype.zeroBits = function () {
							if (this.isZero()) return 0;
							for (var t = 0, r = 0; r < this.length; r++) {
								var i = this._zeroBits(this.words[r]);
								if (((t += i), 26 !== i)) break;
							}
							return t;
						}),
						(o.prototype.byteLength = function () {
							return Math.ceil(this.bitLength() / 8);
						}),
						(o.prototype.toTwos = function (t) {
							return 0 !== this.negative ? this.abs().inotn(t).iaddn(1) : this.clone();
						}),
						(o.prototype.fromTwos = function (t) {
							return this.testn(t - 1) ? this.notn(t).iaddn(1).ineg() : this.clone();
						}),
						(o.prototype.isNeg = function () {
							return 0 !== this.negative;
						}),
						(o.prototype.neg = function () {
							return this.clone().ineg();
						}),
						(o.prototype.ineg = function () {
							return this.isZero() || (this.negative ^= 1), this;
						}),
						(o.prototype.iuor = function (t) {
							for (; this.length < t.length; ) this.words[this.length++] = 0;
							for (var r = 0; r < t.length; r++) this.words[r] = this.words[r] | t.words[r];
							return this.strip();
						}),
						(o.prototype.ior = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuor(t);
						}),
						(o.prototype.or = function (t) {
							return this.length > t.length ? this.clone().ior(t) : t.clone().ior(this);
						}),
						(o.prototype.uor = function (t) {
							return this.length > t.length ? this.clone().iuor(t) : t.clone().iuor(this);
						}),
						(o.prototype.iuand = function (t) {
							var r;
							r = this.length > t.length ? t : this;
							for (var i = 0; i < r.length; i++) this.words[i] = this.words[i] & t.words[i];
							return (this.length = r.length), this.strip();
						}),
						(o.prototype.iand = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuand(t);
						}),
						(o.prototype.and = function (t) {
							return this.length > t.length ? this.clone().iand(t) : t.clone().iand(this);
						}),
						(o.prototype.uand = function (t) {
							return this.length > t.length ? this.clone().iuand(t) : t.clone().iuand(this);
						}),
						(o.prototype.iuxor = function (t) {
							var r, i;
							this.length > t.length ? ((r = this), (i = t)) : ((r = t), (i = this));
							for (var e = 0; e < i.length; e++) this.words[e] = r.words[e] ^ i.words[e];
							if (this !== r) for (; e < r.length; e++) this.words[e] = r.words[e];
							return (this.length = r.length), this.strip();
						}),
						(o.prototype.ixor = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuxor(t);
						}),
						(o.prototype.xor = function (t) {
							return this.length > t.length ? this.clone().ixor(t) : t.clone().ixor(this);
						}),
						(o.prototype.uxor = function (t) {
							return this.length > t.length ? this.clone().iuxor(t) : t.clone().iuxor(this);
						}),
						(o.prototype.inotn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = 0 | Math.ceil(t / 26),
								i = t % 26;
							this._expand(r), i > 0 && r--;
							for (var n = 0; n < r; n++) this.words[n] = 67108863 & ~this.words[n];
							return (
								i > 0 && (this.words[n] = ~this.words[n] & (67108863 >> (26 - i))), this.strip()
							);
						}),
						(o.prototype.notn = function (t) {
							return this.clone().inotn(t);
						}),
						(o.prototype.setn = function (t, r) {
							e('number' == typeof t && t >= 0);
							var i = (t / 26) | 0,
								n = t % 26;
							return (
								this._expand(i + 1),
								(this.words[i] = r ? this.words[i] | (1 << n) : this.words[i] & ~(1 << n)),
								this.strip()
							);
						}),
						(o.prototype.iadd = function (t) {
							var r, i, e;
							if (0 !== this.negative && 0 === t.negative)
								return (
									(this.negative = 0), (r = this.isub(t)), (this.negative ^= 1), this._normSign()
								);
							if (0 === this.negative && 0 !== t.negative)
								return (t.negative = 0), (r = this.isub(t)), (t.negative = 1), r._normSign();
							this.length > t.length ? ((i = this), (e = t)) : ((i = t), (e = this));
							for (var n = 0, o = 0; o < e.length; o++)
								(r = (0 | i.words[o]) + (0 | e.words[o]) + n),
									(this.words[o] = 67108863 & r),
									(n = r >>> 26);
							for (; 0 !== n && o < i.length; o++)
								(r = (0 | i.words[o]) + n), (this.words[o] = 67108863 & r), (n = r >>> 26);
							if (((this.length = i.length), 0 !== n)) (this.words[this.length] = n), this.length++;
							else if (i !== this) for (; o < i.length; o++) this.words[o] = i.words[o];
							return this;
						}),
						(o.prototype.add = function (t) {
							var r;
							return 0 !== t.negative && 0 === this.negative
								? ((t.negative = 0), (r = this.sub(t)), (t.negative ^= 1), r)
								: 0 === t.negative && 0 !== this.negative
								? ((this.negative = 0), (r = t.sub(this)), (this.negative = 1), r)
								: this.length > t.length
								? this.clone().iadd(t)
								: t.clone().iadd(this);
						}),
						(o.prototype.isub = function (t) {
							if (0 !== t.negative) {
								t.negative = 0;
								var r = this.iadd(t);
								return (t.negative = 1), r._normSign();
							}
							if (0 !== this.negative)
								return (this.negative = 0), this.iadd(t), (this.negative = 1), this._normSign();
							var i,
								e,
								n = this.cmp(t);
							if (0 === n) return (this.negative = 0), (this.length = 1), (this.words[0] = 0), this;
							n > 0 ? ((i = this), (e = t)) : ((i = t), (e = this));
							for (var o = 0, s = 0; s < e.length; s++)
								(o = (r = (0 | i.words[s]) - (0 | e.words[s]) + o) >> 26),
									(this.words[s] = 67108863 & r);
							for (; 0 !== o && s < i.length; s++)
								(o = (r = (0 | i.words[s]) + o) >> 26), (this.words[s] = 67108863 & r);
							if (0 === o && s < i.length && i !== this)
								for (; s < i.length; s++) this.words[s] = i.words[s];
							return (
								(this.length = Math.max(this.length, s)),
								i !== this && (this.negative = 1),
								this.strip()
							);
						}),
						(o.prototype.sub = function (t) {
							return this.clone().isub(t);
						});
					var c = function (t, r, i) {
						var e,
							n,
							o,
							s = t.words,
							h = r.words,
							u = i.words,
							a = 0,
							l = 0 | s[0],
							f = 8191 & l,
							m = l >>> 13,
							c = 0 | s[1],
							d = 8191 & c,
							p = c >>> 13,
							g = 0 | s[2],
							v = 8191 & g,
							y = g >>> 13,
							w = 0 | s[3],
							M = 8191 & w,
							b = w >>> 13,
							_ = 0 | s[4],
							A = 8191 & _,
							E = _ >>> 13,
							x = 0 | s[5],
							S = 8191 & x,
							N = x >>> 13,
							T = 0 | s[6],
							R = 8191 & T,
							k = T >>> 13,
							I = 0 | s[7],
							B = 8191 & I,
							O = I >>> 13,
							C = 0 | s[8],
							L = 8191 & C,
							j = C >>> 13,
							P = 0 | s[9],
							U = 8191 & P,
							F = P >>> 13,
							D = 0 | h[0],
							Z = 8191 & D,
							z = D >>> 13,
							q = 0 | h[1],
							H = 8191 & q,
							W = q >>> 13,
							G = 0 | h[2],
							Y = 8191 & G,
							$ = G >>> 13,
							V = 0 | h[3],
							J = 8191 & V,
							K = V >>> 13,
							X = 0 | h[4],
							Q = 8191 & X,
							tt = X >>> 13,
							rt = 0 | h[5],
							it = 8191 & rt,
							et = rt >>> 13,
							nt = 0 | h[6],
							ot = 8191 & nt,
							st = nt >>> 13,
							ht = 0 | h[7],
							ut = 8191 & ht,
							at = ht >>> 13,
							lt = 0 | h[8],
							ft = 8191 & lt,
							mt = lt >>> 13,
							ct = 0 | h[9],
							dt = 8191 & ct,
							pt = ct >>> 13;
						(i.negative = t.negative ^ r.negative), (i.length = 19);
						var gt =
							(((a + (e = Math.imul(f, Z))) | 0) +
								((8191 & (n = ((n = Math.imul(f, z)) + Math.imul(m, Z)) | 0)) << 13)) |
							0;
						(a = ((((o = Math.imul(m, z)) + (n >>> 13)) | 0) + (gt >>> 26)) | 0),
							(gt &= 67108863),
							(e = Math.imul(d, Z)),
							(n = ((n = Math.imul(d, z)) + Math.imul(p, Z)) | 0),
							(o = Math.imul(p, z));
						var vt =
							(((a + (e = (e + Math.imul(f, H)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, W)) | 0) + Math.imul(m, H)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, W)) | 0) + (n >>> 13)) | 0) + (vt >>> 26)) | 0),
							(vt &= 67108863),
							(e = Math.imul(v, Z)),
							(n = ((n = Math.imul(v, z)) + Math.imul(y, Z)) | 0),
							(o = Math.imul(y, z)),
							(e = (e + Math.imul(d, H)) | 0),
							(n = ((n = (n + Math.imul(d, W)) | 0) + Math.imul(p, H)) | 0),
							(o = (o + Math.imul(p, W)) | 0);
						var yt =
							(((a + (e = (e + Math.imul(f, Y)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, $)) | 0) + Math.imul(m, Y)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, $)) | 0) + (n >>> 13)) | 0) + (yt >>> 26)) | 0),
							(yt &= 67108863),
							(e = Math.imul(M, Z)),
							(n = ((n = Math.imul(M, z)) + Math.imul(b, Z)) | 0),
							(o = Math.imul(b, z)),
							(e = (e + Math.imul(v, H)) | 0),
							(n = ((n = (n + Math.imul(v, W)) | 0) + Math.imul(y, H)) | 0),
							(o = (o + Math.imul(y, W)) | 0),
							(e = (e + Math.imul(d, Y)) | 0),
							(n = ((n = (n + Math.imul(d, $)) | 0) + Math.imul(p, Y)) | 0),
							(o = (o + Math.imul(p, $)) | 0);
						var wt =
							(((a + (e = (e + Math.imul(f, J)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, K)) | 0) + Math.imul(m, J)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, K)) | 0) + (n >>> 13)) | 0) + (wt >>> 26)) | 0),
							(wt &= 67108863),
							(e = Math.imul(A, Z)),
							(n = ((n = Math.imul(A, z)) + Math.imul(E, Z)) | 0),
							(o = Math.imul(E, z)),
							(e = (e + Math.imul(M, H)) | 0),
							(n = ((n = (n + Math.imul(M, W)) | 0) + Math.imul(b, H)) | 0),
							(o = (o + Math.imul(b, W)) | 0),
							(e = (e + Math.imul(v, Y)) | 0),
							(n = ((n = (n + Math.imul(v, $)) | 0) + Math.imul(y, Y)) | 0),
							(o = (o + Math.imul(y, $)) | 0),
							(e = (e + Math.imul(d, J)) | 0),
							(n = ((n = (n + Math.imul(d, K)) | 0) + Math.imul(p, J)) | 0),
							(o = (o + Math.imul(p, K)) | 0);
						var Mt =
							(((a + (e = (e + Math.imul(f, Q)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, tt)) | 0) + Math.imul(m, Q)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, tt)) | 0) + (n >>> 13)) | 0) + (Mt >>> 26)) | 0),
							(Mt &= 67108863),
							(e = Math.imul(S, Z)),
							(n = ((n = Math.imul(S, z)) + Math.imul(N, Z)) | 0),
							(o = Math.imul(N, z)),
							(e = (e + Math.imul(A, H)) | 0),
							(n = ((n = (n + Math.imul(A, W)) | 0) + Math.imul(E, H)) | 0),
							(o = (o + Math.imul(E, W)) | 0),
							(e = (e + Math.imul(M, Y)) | 0),
							(n = ((n = (n + Math.imul(M, $)) | 0) + Math.imul(b, Y)) | 0),
							(o = (o + Math.imul(b, $)) | 0),
							(e = (e + Math.imul(v, J)) | 0),
							(n = ((n = (n + Math.imul(v, K)) | 0) + Math.imul(y, J)) | 0),
							(o = (o + Math.imul(y, K)) | 0),
							(e = (e + Math.imul(d, Q)) | 0),
							(n = ((n = (n + Math.imul(d, tt)) | 0) + Math.imul(p, Q)) | 0),
							(o = (o + Math.imul(p, tt)) | 0);
						var bt =
							(((a + (e = (e + Math.imul(f, it)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, et)) | 0) + Math.imul(m, it)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, et)) | 0) + (n >>> 13)) | 0) + (bt >>> 26)) | 0),
							(bt &= 67108863),
							(e = Math.imul(R, Z)),
							(n = ((n = Math.imul(R, z)) + Math.imul(k, Z)) | 0),
							(o = Math.imul(k, z)),
							(e = (e + Math.imul(S, H)) | 0),
							(n = ((n = (n + Math.imul(S, W)) | 0) + Math.imul(N, H)) | 0),
							(o = (o + Math.imul(N, W)) | 0),
							(e = (e + Math.imul(A, Y)) | 0),
							(n = ((n = (n + Math.imul(A, $)) | 0) + Math.imul(E, Y)) | 0),
							(o = (o + Math.imul(E, $)) | 0),
							(e = (e + Math.imul(M, J)) | 0),
							(n = ((n = (n + Math.imul(M, K)) | 0) + Math.imul(b, J)) | 0),
							(o = (o + Math.imul(b, K)) | 0),
							(e = (e + Math.imul(v, Q)) | 0),
							(n = ((n = (n + Math.imul(v, tt)) | 0) + Math.imul(y, Q)) | 0),
							(o = (o + Math.imul(y, tt)) | 0),
							(e = (e + Math.imul(d, it)) | 0),
							(n = ((n = (n + Math.imul(d, et)) | 0) + Math.imul(p, it)) | 0),
							(o = (o + Math.imul(p, et)) | 0);
						var _t =
							(((a + (e = (e + Math.imul(f, ot)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, st)) | 0) + Math.imul(m, ot)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, st)) | 0) + (n >>> 13)) | 0) + (_t >>> 26)) | 0),
							(_t &= 67108863),
							(e = Math.imul(B, Z)),
							(n = ((n = Math.imul(B, z)) + Math.imul(O, Z)) | 0),
							(o = Math.imul(O, z)),
							(e = (e + Math.imul(R, H)) | 0),
							(n = ((n = (n + Math.imul(R, W)) | 0) + Math.imul(k, H)) | 0),
							(o = (o + Math.imul(k, W)) | 0),
							(e = (e + Math.imul(S, Y)) | 0),
							(n = ((n = (n + Math.imul(S, $)) | 0) + Math.imul(N, Y)) | 0),
							(o = (o + Math.imul(N, $)) | 0),
							(e = (e + Math.imul(A, J)) | 0),
							(n = ((n = (n + Math.imul(A, K)) | 0) + Math.imul(E, J)) | 0),
							(o = (o + Math.imul(E, K)) | 0),
							(e = (e + Math.imul(M, Q)) | 0),
							(n = ((n = (n + Math.imul(M, tt)) | 0) + Math.imul(b, Q)) | 0),
							(o = (o + Math.imul(b, tt)) | 0),
							(e = (e + Math.imul(v, it)) | 0),
							(n = ((n = (n + Math.imul(v, et)) | 0) + Math.imul(y, it)) | 0),
							(o = (o + Math.imul(y, et)) | 0),
							(e = (e + Math.imul(d, ot)) | 0),
							(n = ((n = (n + Math.imul(d, st)) | 0) + Math.imul(p, ot)) | 0),
							(o = (o + Math.imul(p, st)) | 0);
						var At =
							(((a + (e = (e + Math.imul(f, ut)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, at)) | 0) + Math.imul(m, ut)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, at)) | 0) + (n >>> 13)) | 0) + (At >>> 26)) | 0),
							(At &= 67108863),
							(e = Math.imul(L, Z)),
							(n = ((n = Math.imul(L, z)) + Math.imul(j, Z)) | 0),
							(o = Math.imul(j, z)),
							(e = (e + Math.imul(B, H)) | 0),
							(n = ((n = (n + Math.imul(B, W)) | 0) + Math.imul(O, H)) | 0),
							(o = (o + Math.imul(O, W)) | 0),
							(e = (e + Math.imul(R, Y)) | 0),
							(n = ((n = (n + Math.imul(R, $)) | 0) + Math.imul(k, Y)) | 0),
							(o = (o + Math.imul(k, $)) | 0),
							(e = (e + Math.imul(S, J)) | 0),
							(n = ((n = (n + Math.imul(S, K)) | 0) + Math.imul(N, J)) | 0),
							(o = (o + Math.imul(N, K)) | 0),
							(e = (e + Math.imul(A, Q)) | 0),
							(n = ((n = (n + Math.imul(A, tt)) | 0) + Math.imul(E, Q)) | 0),
							(o = (o + Math.imul(E, tt)) | 0),
							(e = (e + Math.imul(M, it)) | 0),
							(n = ((n = (n + Math.imul(M, et)) | 0) + Math.imul(b, it)) | 0),
							(o = (o + Math.imul(b, et)) | 0),
							(e = (e + Math.imul(v, ot)) | 0),
							(n = ((n = (n + Math.imul(v, st)) | 0) + Math.imul(y, ot)) | 0),
							(o = (o + Math.imul(y, st)) | 0),
							(e = (e + Math.imul(d, ut)) | 0),
							(n = ((n = (n + Math.imul(d, at)) | 0) + Math.imul(p, ut)) | 0),
							(o = (o + Math.imul(p, at)) | 0);
						var Et =
							(((a + (e = (e + Math.imul(f, ft)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, mt)) | 0) + Math.imul(m, ft)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, mt)) | 0) + (n >>> 13)) | 0) + (Et >>> 26)) | 0),
							(Et &= 67108863),
							(e = Math.imul(U, Z)),
							(n = ((n = Math.imul(U, z)) + Math.imul(F, Z)) | 0),
							(o = Math.imul(F, z)),
							(e = (e + Math.imul(L, H)) | 0),
							(n = ((n = (n + Math.imul(L, W)) | 0) + Math.imul(j, H)) | 0),
							(o = (o + Math.imul(j, W)) | 0),
							(e = (e + Math.imul(B, Y)) | 0),
							(n = ((n = (n + Math.imul(B, $)) | 0) + Math.imul(O, Y)) | 0),
							(o = (o + Math.imul(O, $)) | 0),
							(e = (e + Math.imul(R, J)) | 0),
							(n = ((n = (n + Math.imul(R, K)) | 0) + Math.imul(k, J)) | 0),
							(o = (o + Math.imul(k, K)) | 0),
							(e = (e + Math.imul(S, Q)) | 0),
							(n = ((n = (n + Math.imul(S, tt)) | 0) + Math.imul(N, Q)) | 0),
							(o = (o + Math.imul(N, tt)) | 0),
							(e = (e + Math.imul(A, it)) | 0),
							(n = ((n = (n + Math.imul(A, et)) | 0) + Math.imul(E, it)) | 0),
							(o = (o + Math.imul(E, et)) | 0),
							(e = (e + Math.imul(M, ot)) | 0),
							(n = ((n = (n + Math.imul(M, st)) | 0) + Math.imul(b, ot)) | 0),
							(o = (o + Math.imul(b, st)) | 0),
							(e = (e + Math.imul(v, ut)) | 0),
							(n = ((n = (n + Math.imul(v, at)) | 0) + Math.imul(y, ut)) | 0),
							(o = (o + Math.imul(y, at)) | 0),
							(e = (e + Math.imul(d, ft)) | 0),
							(n = ((n = (n + Math.imul(d, mt)) | 0) + Math.imul(p, ft)) | 0),
							(o = (o + Math.imul(p, mt)) | 0);
						var xt =
							(((a + (e = (e + Math.imul(f, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, pt)) | 0) + Math.imul(m, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, pt)) | 0) + (n >>> 13)) | 0) + (xt >>> 26)) | 0),
							(xt &= 67108863),
							(e = Math.imul(U, H)),
							(n = ((n = Math.imul(U, W)) + Math.imul(F, H)) | 0),
							(o = Math.imul(F, W)),
							(e = (e + Math.imul(L, Y)) | 0),
							(n = ((n = (n + Math.imul(L, $)) | 0) + Math.imul(j, Y)) | 0),
							(o = (o + Math.imul(j, $)) | 0),
							(e = (e + Math.imul(B, J)) | 0),
							(n = ((n = (n + Math.imul(B, K)) | 0) + Math.imul(O, J)) | 0),
							(o = (o + Math.imul(O, K)) | 0),
							(e = (e + Math.imul(R, Q)) | 0),
							(n = ((n = (n + Math.imul(R, tt)) | 0) + Math.imul(k, Q)) | 0),
							(o = (o + Math.imul(k, tt)) | 0),
							(e = (e + Math.imul(S, it)) | 0),
							(n = ((n = (n + Math.imul(S, et)) | 0) + Math.imul(N, it)) | 0),
							(o = (o + Math.imul(N, et)) | 0),
							(e = (e + Math.imul(A, ot)) | 0),
							(n = ((n = (n + Math.imul(A, st)) | 0) + Math.imul(E, ot)) | 0),
							(o = (o + Math.imul(E, st)) | 0),
							(e = (e + Math.imul(M, ut)) | 0),
							(n = ((n = (n + Math.imul(M, at)) | 0) + Math.imul(b, ut)) | 0),
							(o = (o + Math.imul(b, at)) | 0),
							(e = (e + Math.imul(v, ft)) | 0),
							(n = ((n = (n + Math.imul(v, mt)) | 0) + Math.imul(y, ft)) | 0),
							(o = (o + Math.imul(y, mt)) | 0);
						var St =
							(((a + (e = (e + Math.imul(d, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(d, pt)) | 0) + Math.imul(p, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(p, pt)) | 0) + (n >>> 13)) | 0) + (St >>> 26)) | 0),
							(St &= 67108863),
							(e = Math.imul(U, Y)),
							(n = ((n = Math.imul(U, $)) + Math.imul(F, Y)) | 0),
							(o = Math.imul(F, $)),
							(e = (e + Math.imul(L, J)) | 0),
							(n = ((n = (n + Math.imul(L, K)) | 0) + Math.imul(j, J)) | 0),
							(o = (o + Math.imul(j, K)) | 0),
							(e = (e + Math.imul(B, Q)) | 0),
							(n = ((n = (n + Math.imul(B, tt)) | 0) + Math.imul(O, Q)) | 0),
							(o = (o + Math.imul(O, tt)) | 0),
							(e = (e + Math.imul(R, it)) | 0),
							(n = ((n = (n + Math.imul(R, et)) | 0) + Math.imul(k, it)) | 0),
							(o = (o + Math.imul(k, et)) | 0),
							(e = (e + Math.imul(S, ot)) | 0),
							(n = ((n = (n + Math.imul(S, st)) | 0) + Math.imul(N, ot)) | 0),
							(o = (o + Math.imul(N, st)) | 0),
							(e = (e + Math.imul(A, ut)) | 0),
							(n = ((n = (n + Math.imul(A, at)) | 0) + Math.imul(E, ut)) | 0),
							(o = (o + Math.imul(E, at)) | 0),
							(e = (e + Math.imul(M, ft)) | 0),
							(n = ((n = (n + Math.imul(M, mt)) | 0) + Math.imul(b, ft)) | 0),
							(o = (o + Math.imul(b, mt)) | 0);
						var Nt =
							(((a + (e = (e + Math.imul(v, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(v, pt)) | 0) + Math.imul(y, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(y, pt)) | 0) + (n >>> 13)) | 0) + (Nt >>> 26)) | 0),
							(Nt &= 67108863),
							(e = Math.imul(U, J)),
							(n = ((n = Math.imul(U, K)) + Math.imul(F, J)) | 0),
							(o = Math.imul(F, K)),
							(e = (e + Math.imul(L, Q)) | 0),
							(n = ((n = (n + Math.imul(L, tt)) | 0) + Math.imul(j, Q)) | 0),
							(o = (o + Math.imul(j, tt)) | 0),
							(e = (e + Math.imul(B, it)) | 0),
							(n = ((n = (n + Math.imul(B, et)) | 0) + Math.imul(O, it)) | 0),
							(o = (o + Math.imul(O, et)) | 0),
							(e = (e + Math.imul(R, ot)) | 0),
							(n = ((n = (n + Math.imul(R, st)) | 0) + Math.imul(k, ot)) | 0),
							(o = (o + Math.imul(k, st)) | 0),
							(e = (e + Math.imul(S, ut)) | 0),
							(n = ((n = (n + Math.imul(S, at)) | 0) + Math.imul(N, ut)) | 0),
							(o = (o + Math.imul(N, at)) | 0),
							(e = (e + Math.imul(A, ft)) | 0),
							(n = ((n = (n + Math.imul(A, mt)) | 0) + Math.imul(E, ft)) | 0),
							(o = (o + Math.imul(E, mt)) | 0);
						var Tt =
							(((a + (e = (e + Math.imul(M, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(M, pt)) | 0) + Math.imul(b, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(b, pt)) | 0) + (n >>> 13)) | 0) + (Tt >>> 26)) | 0),
							(Tt &= 67108863),
							(e = Math.imul(U, Q)),
							(n = ((n = Math.imul(U, tt)) + Math.imul(F, Q)) | 0),
							(o = Math.imul(F, tt)),
							(e = (e + Math.imul(L, it)) | 0),
							(n = ((n = (n + Math.imul(L, et)) | 0) + Math.imul(j, it)) | 0),
							(o = (o + Math.imul(j, et)) | 0),
							(e = (e + Math.imul(B, ot)) | 0),
							(n = ((n = (n + Math.imul(B, st)) | 0) + Math.imul(O, ot)) | 0),
							(o = (o + Math.imul(O, st)) | 0),
							(e = (e + Math.imul(R, ut)) | 0),
							(n = ((n = (n + Math.imul(R, at)) | 0) + Math.imul(k, ut)) | 0),
							(o = (o + Math.imul(k, at)) | 0),
							(e = (e + Math.imul(S, ft)) | 0),
							(n = ((n = (n + Math.imul(S, mt)) | 0) + Math.imul(N, ft)) | 0),
							(o = (o + Math.imul(N, mt)) | 0);
						var Rt =
							(((a + (e = (e + Math.imul(A, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(A, pt)) | 0) + Math.imul(E, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(E, pt)) | 0) + (n >>> 13)) | 0) + (Rt >>> 26)) | 0),
							(Rt &= 67108863),
							(e = Math.imul(U, it)),
							(n = ((n = Math.imul(U, et)) + Math.imul(F, it)) | 0),
							(o = Math.imul(F, et)),
							(e = (e + Math.imul(L, ot)) | 0),
							(n = ((n = (n + Math.imul(L, st)) | 0) + Math.imul(j, ot)) | 0),
							(o = (o + Math.imul(j, st)) | 0),
							(e = (e + Math.imul(B, ut)) | 0),
							(n = ((n = (n + Math.imul(B, at)) | 0) + Math.imul(O, ut)) | 0),
							(o = (o + Math.imul(O, at)) | 0),
							(e = (e + Math.imul(R, ft)) | 0),
							(n = ((n = (n + Math.imul(R, mt)) | 0) + Math.imul(k, ft)) | 0),
							(o = (o + Math.imul(k, mt)) | 0);
						var kt =
							(((a + (e = (e + Math.imul(S, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(S, pt)) | 0) + Math.imul(N, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(N, pt)) | 0) + (n >>> 13)) | 0) + (kt >>> 26)) | 0),
							(kt &= 67108863),
							(e = Math.imul(U, ot)),
							(n = ((n = Math.imul(U, st)) + Math.imul(F, ot)) | 0),
							(o = Math.imul(F, st)),
							(e = (e + Math.imul(L, ut)) | 0),
							(n = ((n = (n + Math.imul(L, at)) | 0) + Math.imul(j, ut)) | 0),
							(o = (o + Math.imul(j, at)) | 0),
							(e = (e + Math.imul(B, ft)) | 0),
							(n = ((n = (n + Math.imul(B, mt)) | 0) + Math.imul(O, ft)) | 0),
							(o = (o + Math.imul(O, mt)) | 0);
						var It =
							(((a + (e = (e + Math.imul(R, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(R, pt)) | 0) + Math.imul(k, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(k, pt)) | 0) + (n >>> 13)) | 0) + (It >>> 26)) | 0),
							(It &= 67108863),
							(e = Math.imul(U, ut)),
							(n = ((n = Math.imul(U, at)) + Math.imul(F, ut)) | 0),
							(o = Math.imul(F, at)),
							(e = (e + Math.imul(L, ft)) | 0),
							(n = ((n = (n + Math.imul(L, mt)) | 0) + Math.imul(j, ft)) | 0),
							(o = (o + Math.imul(j, mt)) | 0);
						var Bt =
							(((a + (e = (e + Math.imul(B, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(B, pt)) | 0) + Math.imul(O, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(O, pt)) | 0) + (n >>> 13)) | 0) + (Bt >>> 26)) | 0),
							(Bt &= 67108863),
							(e = Math.imul(U, ft)),
							(n = ((n = Math.imul(U, mt)) + Math.imul(F, ft)) | 0),
							(o = Math.imul(F, mt));
						var Ot =
							(((a + (e = (e + Math.imul(L, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(L, pt)) | 0) + Math.imul(j, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(j, pt)) | 0) + (n >>> 13)) | 0) + (Ot >>> 26)) | 0),
							(Ot &= 67108863);
						var Ct =
							(((a + (e = Math.imul(U, dt))) | 0) +
								((8191 & (n = ((n = Math.imul(U, pt)) + Math.imul(F, dt)) | 0)) << 13)) |
							0;
						return (
							(a = ((((o = Math.imul(F, pt)) + (n >>> 13)) | 0) + (Ct >>> 26)) | 0),
							(Ct &= 67108863),
							(u[0] = gt),
							(u[1] = vt),
							(u[2] = yt),
							(u[3] = wt),
							(u[4] = Mt),
							(u[5] = bt),
							(u[6] = _t),
							(u[7] = At),
							(u[8] = Et),
							(u[9] = xt),
							(u[10] = St),
							(u[11] = Nt),
							(u[12] = Tt),
							(u[13] = Rt),
							(u[14] = kt),
							(u[15] = It),
							(u[16] = Bt),
							(u[17] = Ot),
							(u[18] = Ct),
							0 !== a && ((u[19] = a), i.length++),
							i
						);
					};
					function d(t, r, i) {
						return new p().mulp(t, r, i);
					}
					function p(t, r) {
						(this.x = t), (this.y = r);
					}
					Math.imul || (c = m),
						(o.prototype.mulTo = function (t, r) {
							var i = this.length + t.length;
							return 10 === this.length && 10 === t.length
								? c(this, t, r)
								: i < 63
								? m(this, t, r)
								: i < 1024
								? (function (t, r, i) {
										(i.negative = r.negative ^ t.negative), (i.length = t.length + r.length);
										for (var e = 0, n = 0, o = 0; o < i.length - 1; o++) {
											var s = n;
											n = 0;
											for (
												var h = 67108863 & e,
													u = Math.min(o, r.length - 1),
													a = Math.max(0, o - t.length + 1);
												a <= u;
												a++
											) {
												var l = o - a,
													f = (0 | t.words[l]) * (0 | r.words[a]),
													m = 67108863 & f;
												(h = 67108863 & (m = (m + h) | 0)),
													(n +=
														(s = ((s = (s + ((f / 67108864) | 0)) | 0) + (m >>> 26)) | 0) >>> 26),
													(s &= 67108863);
											}
											(i.words[o] = h), (e = s), (s = n);
										}
										return 0 !== e ? (i.words[o] = e) : i.length--, i.strip();
								  })(this, t, r)
								: d(this, t, r);
						}),
						(p.prototype.makeRBT = function (t) {
							for (var r = new Array(t), i = o.prototype._countBits(t) - 1, e = 0; e < t; e++)
								r[e] = this.revBin(e, i, t);
							return r;
						}),
						(p.prototype.revBin = function (t, r, i) {
							if (0 === t || t === i - 1) return t;
							for (var e = 0, n = 0; n < r; n++) (e |= (1 & t) << (r - n - 1)), (t >>= 1);
							return e;
						}),
						(p.prototype.permute = function (t, r, i, e, n, o) {
							for (var s = 0; s < o; s++) (e[s] = r[t[s]]), (n[s] = i[t[s]]);
						}),
						(p.prototype.transform = function (t, r, i, e, n, o) {
							this.permute(o, t, r, i, e, n);
							for (var s = 1; s < n; s <<= 1)
								for (
									var h = s << 1,
										u = Math.cos((2 * Math.PI) / h),
										a = Math.sin((2 * Math.PI) / h),
										l = 0;
									l < n;
									l += h
								)
									for (var f = u, m = a, c = 0; c < s; c++) {
										var d = i[l + c],
											p = e[l + c],
											g = i[l + c + s],
											v = e[l + c + s],
											y = f * g - m * v;
										(v = f * v + m * g),
											(g = y),
											(i[l + c] = d + g),
											(e[l + c] = p + v),
											(i[l + c + s] = d - g),
											(e[l + c + s] = p - v),
											c !== h && ((y = u * f - a * m), (m = u * m + a * f), (f = y));
									}
						}),
						(p.prototype.guessLen13b = function (t, r) {
							var i = 1 | Math.max(r, t),
								e = 1 & i,
								n = 0;
							for (i = (i / 2) | 0; i; i >>>= 1) n++;
							return 1 << (n + 1 + e);
						}),
						(p.prototype.conjugate = function (t, r, i) {
							if (!(i <= 1))
								for (var e = 0; e < i / 2; e++) {
									var n = t[e];
									(t[e] = t[i - e - 1]),
										(t[i - e - 1] = n),
										(n = r[e]),
										(r[e] = -r[i - e - 1]),
										(r[i - e - 1] = -n);
								}
						}),
						(p.prototype.normalize13b = function (t, r) {
							for (var i = 0, e = 0; e < r / 2; e++) {
								var n = 8192 * Math.round(t[2 * e + 1] / r) + Math.round(t[2 * e] / r) + i;
								(t[e] = 67108863 & n), (i = n < 67108864 ? 0 : (n / 67108864) | 0);
							}
							return t;
						}),
						(p.prototype.convert13b = function (t, r, i, n) {
							for (var o = 0, s = 0; s < r; s++)
								(o += 0 | t[s]),
									(i[2 * s] = 8191 & o),
									(o >>>= 13),
									(i[2 * s + 1] = 8191 & o),
									(o >>>= 13);
							for (s = 2 * r; s < n; ++s) i[s] = 0;
							e(0 === o), e(0 == (-8192 & o));
						}),
						(p.prototype.stub = function (t) {
							for (var r = new Array(t), i = 0; i < t; i++) r[i] = 0;
							return r;
						}),
						(p.prototype.mulp = function (t, r, i) {
							var e = 2 * this.guessLen13b(t.length, r.length),
								n = this.makeRBT(e),
								o = this.stub(e),
								s = new Array(e),
								h = new Array(e),
								u = new Array(e),
								a = new Array(e),
								l = new Array(e),
								f = new Array(e),
								m = i.words;
							(m.length = e),
								this.convert13b(t.words, t.length, s, e),
								this.convert13b(r.words, r.length, a, e),
								this.transform(s, o, h, u, e, n),
								this.transform(a, o, l, f, e, n);
							for (var c = 0; c < e; c++) {
								var d = h[c] * l[c] - u[c] * f[c];
								(u[c] = h[c] * f[c] + u[c] * l[c]), (h[c] = d);
							}
							return (
								this.conjugate(h, u, e),
								this.transform(h, u, m, o, e, n),
								this.conjugate(m, o, e),
								this.normalize13b(m, e),
								(i.negative = t.negative ^ r.negative),
								(i.length = t.length + r.length),
								i.strip()
							);
						}),
						(o.prototype.mul = function (t) {
							var r = new o(null);
							return (r.words = new Array(this.length + t.length)), this.mulTo(t, r);
						}),
						(o.prototype.mulf = function (t) {
							var r = new o(null);
							return (r.words = new Array(this.length + t.length)), d(this, t, r);
						}),
						(o.prototype.imul = function (t) {
							return this.clone().mulTo(t, this);
						}),
						(o.prototype.imuln = function (t) {
							e('number' == typeof t), e(t < 67108864);
							for (var r = 0, i = 0; i < this.length; i++) {
								var n = (0 | this.words[i]) * t,
									o = (67108863 & n) + (67108863 & r);
								(r >>= 26),
									(r += (n / 67108864) | 0),
									(r += o >>> 26),
									(this.words[i] = 67108863 & o);
							}
							return 0 !== r && ((this.words[i] = r), this.length++), this;
						}),
						(o.prototype.muln = function (t) {
							return this.clone().imuln(t);
						}),
						(o.prototype.sqr = function () {
							return this.mul(this);
						}),
						(o.prototype.isqr = function () {
							return this.imul(this.clone());
						}),
						(o.prototype.pow = function (t) {
							var r = (function (t) {
								for (var r = new Array(t.bitLength()), i = 0; i < r.length; i++) {
									var e = (i / 26) | 0,
										n = i % 26;
									r[i] = (t.words[e] & (1 << n)) >>> n;
								}
								return r;
							})(t);
							if (0 === r.length) return new o(1);
							for (var i = this, e = 0; e < r.length && 0 === r[e]; e++, i = i.sqr());
							if (++e < r.length)
								for (var n = i.sqr(); e < r.length; e++, n = n.sqr()) 0 !== r[e] && (i = i.mul(n));
							return i;
						}),
						(o.prototype.iushln = function (t) {
							e('number' == typeof t && t >= 0);
							var r,
								i = t % 26,
								n = (t - i) / 26,
								o = (67108863 >>> (26 - i)) << (26 - i);
							if (0 !== i) {
								var s = 0;
								for (r = 0; r < this.length; r++) {
									var h = this.words[r] & o,
										u = ((0 | this.words[r]) - h) << i;
									(this.words[r] = u | s), (s = h >>> (26 - i));
								}
								s && ((this.words[r] = s), this.length++);
							}
							if (0 !== n) {
								for (r = this.length - 1; r >= 0; r--) this.words[r + n] = this.words[r];
								for (r = 0; r < n; r++) this.words[r] = 0;
								this.length += n;
							}
							return this.strip();
						}),
						(o.prototype.ishln = function (t) {
							return e(0 === this.negative), this.iushln(t);
						}),
						(o.prototype.iushrn = function (t, r, i) {
							var n;
							e('number' == typeof t && t >= 0), (n = r ? (r - (r % 26)) / 26 : 0);
							var o = t % 26,
								s = Math.min((t - o) / 26, this.length),
								h = 67108863 ^ ((67108863 >>> o) << o),
								u = i;
							if (((n -= s), (n = Math.max(0, n)), u)) {
								for (var a = 0; a < s; a++) u.words[a] = this.words[a];
								u.length = s;
							}
							if (0 === s);
							else if (this.length > s)
								for (this.length -= s, a = 0; a < this.length; a++)
									this.words[a] = this.words[a + s];
							else (this.words[0] = 0), (this.length = 1);
							var l = 0;
							for (a = this.length - 1; a >= 0 && (0 !== l || a >= n); a--) {
								var f = 0 | this.words[a];
								(this.words[a] = (l << (26 - o)) | (f >>> o)), (l = f & h);
							}
							return (
								u && 0 !== l && (u.words[u.length++] = l),
								0 === this.length && ((this.words[0] = 0), (this.length = 1)),
								this.strip()
							);
						}),
						(o.prototype.ishrn = function (t, r, i) {
							return e(0 === this.negative), this.iushrn(t, r, i);
						}),
						(o.prototype.shln = function (t) {
							return this.clone().ishln(t);
						}),
						(o.prototype.ushln = function (t) {
							return this.clone().iushln(t);
						}),
						(o.prototype.shrn = function (t) {
							return this.clone().ishrn(t);
						}),
						(o.prototype.ushrn = function (t) {
							return this.clone().iushrn(t);
						}),
						(o.prototype.testn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = t % 26,
								i = (t - r) / 26,
								n = 1 << r;
							return !(this.length <= i) && !!(this.words[i] & n);
						}),
						(o.prototype.imaskn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = t % 26,
								i = (t - r) / 26;
							if (
								(e(0 === this.negative, 'imaskn works only with positive numbers'),
								this.length <= i)
							)
								return this;
							if ((0 !== r && i++, (this.length = Math.min(i, this.length)), 0 !== r)) {
								var n = 67108863 ^ ((67108863 >>> r) << r);
								this.words[this.length - 1] &= n;
							}
							return this.strip();
						}),
						(o.prototype.maskn = function (t) {
							return this.clone().imaskn(t);
						}),
						(o.prototype.iaddn = function (t) {
							return (
								e('number' == typeof t),
								e(t < 67108864),
								t < 0
									? this.isubn(-t)
									: 0 !== this.negative
									? 1 === this.length && (0 | this.words[0]) < t
										? ((this.words[0] = t - (0 | this.words[0])), (this.negative = 0), this)
										: ((this.negative = 0), this.isubn(t), (this.negative = 1), this)
									: this._iaddn(t)
							);
						}),
						(o.prototype._iaddn = function (t) {
							this.words[0] += t;
							for (var r = 0; r < this.length && this.words[r] >= 67108864; r++)
								(this.words[r] -= 67108864),
									r === this.length - 1 ? (this.words[r + 1] = 1) : this.words[r + 1]++;
							return (this.length = Math.max(this.length, r + 1)), this;
						}),
						(o.prototype.isubn = function (t) {
							if ((e('number' == typeof t), e(t < 67108864), t < 0)) return this.iaddn(-t);
							if (0 !== this.negative)
								return (this.negative = 0), this.iaddn(t), (this.negative = 1), this;
							if (((this.words[0] -= t), 1 === this.length && this.words[0] < 0))
								(this.words[0] = -this.words[0]), (this.negative = 1);
							else
								for (var r = 0; r < this.length && this.words[r] < 0; r++)
									(this.words[r] += 67108864), (this.words[r + 1] -= 1);
							return this.strip();
						}),
						(o.prototype.addn = function (t) {
							return this.clone().iaddn(t);
						}),
						(o.prototype.subn = function (t) {
							return this.clone().isubn(t);
						}),
						(o.prototype.iabs = function () {
							return (this.negative = 0), this;
						}),
						(o.prototype.abs = function () {
							return this.clone().iabs();
						}),
						(o.prototype._ishlnsubmul = function (t, r, i) {
							var n,
								o,
								s = t.length + i;
							this._expand(s);
							var h = 0;
							for (n = 0; n < t.length; n++) {
								o = (0 | this.words[n + i]) + h;
								var u = (0 | t.words[n]) * r;
								(h = ((o -= 67108863 & u) >> 26) - ((u / 67108864) | 0)),
									(this.words[n + i] = 67108863 & o);
							}
							for (; n < this.length - i; n++)
								(h = (o = (0 | this.words[n + i]) + h) >> 26), (this.words[n + i] = 67108863 & o);
							if (0 === h) return this.strip();
							for (e(-1 === h), h = 0, n = 0; n < this.length; n++)
								(h = (o = -(0 | this.words[n]) + h) >> 26), (this.words[n] = 67108863 & o);
							return (this.negative = 1), this.strip();
						}),
						(o.prototype._wordDiv = function (t, r) {
							var i = (this.length, t.length),
								e = this.clone(),
								n = t,
								s = 0 | n.words[n.length - 1];
							0 !== (i = 26 - this._countBits(s)) &&
								((n = n.ushln(i)), e.iushln(i), (s = 0 | n.words[n.length - 1]));
							var h,
								u = e.length - n.length;
							if ('mod' !== r) {
								((h = new o(null)).length = u + 1), (h.words = new Array(h.length));
								for (var a = 0; a < h.length; a++) h.words[a] = 0;
							}
							var l = e.clone()._ishlnsubmul(n, 1, u);
							0 === l.negative && ((e = l), h && (h.words[u] = 1));
							for (var f = u - 1; f >= 0; f--) {
								var m = 67108864 * (0 | e.words[n.length + f]) + (0 | e.words[n.length + f - 1]);
								for (
									m = Math.min((m / s) | 0, 67108863), e._ishlnsubmul(n, m, f);
									0 !== e.negative;

								)
									m--, (e.negative = 0), e._ishlnsubmul(n, 1, f), e.isZero() || (e.negative ^= 1);
								h && (h.words[f] = m);
							}
							return (
								h && h.strip(),
								e.strip(),
								'div' !== r && 0 !== i && e.iushrn(i),
								{ div: h || null, mod: e }
							);
						}),
						(o.prototype.divmod = function (t, r, i) {
							return (
								e(!t.isZero()),
								this.isZero()
									? { div: new o(0), mod: new o(0) }
									: 0 !== this.negative && 0 === t.negative
									? ((h = this.neg().divmod(t, r)),
									  'mod' !== r && (n = h.div.neg()),
									  'div' !== r && ((s = h.mod.neg()), i && 0 !== s.negative && s.iadd(t)),
									  { div: n, mod: s })
									: 0 === this.negative && 0 !== t.negative
									? ((h = this.divmod(t.neg(), r)),
									  'mod' !== r && (n = h.div.neg()),
									  { div: n, mod: h.mod })
									: 0 != (this.negative & t.negative)
									? ((h = this.neg().divmod(t.neg(), r)),
									  'div' !== r && ((s = h.mod.neg()), i && 0 !== s.negative && s.isub(t)),
									  { div: h.div, mod: s })
									: t.length > this.length || this.cmp(t) < 0
									? { div: new o(0), mod: this }
									: 1 === t.length
									? 'div' === r
										? { div: this.divn(t.words[0]), mod: null }
										: 'mod' === r
										? { div: null, mod: new o(this.modn(t.words[0])) }
										: { div: this.divn(t.words[0]), mod: new o(this.modn(t.words[0])) }
									: this._wordDiv(t, r)
							);
							var n, s, h;
						}),
						(o.prototype.div = function (t) {
							return this.divmod(t, 'div', !1).div;
						}),
						(o.prototype.mod = function (t) {
							return this.divmod(t, 'mod', !1).mod;
						}),
						(o.prototype.umod = function (t) {
							return this.divmod(t, 'mod', !0).mod;
						}),
						(o.prototype.divRound = function (t) {
							var r = this.divmod(t);
							if (r.mod.isZero()) return r.div;
							var i = 0 !== r.div.negative ? r.mod.isub(t) : r.mod,
								e = t.ushrn(1),
								n = t.andln(1),
								o = i.cmp(e);
							return o < 0 || (1 === n && 0 === o)
								? r.div
								: 0 !== r.div.negative
								? r.div.isubn(1)
								: r.div.iaddn(1);
						}),
						(o.prototype.modn = function (t) {
							e(t <= 67108863);
							for (var r = (1 << 26) % t, i = 0, n = this.length - 1; n >= 0; n--)
								i = (r * i + (0 | this.words[n])) % t;
							return i;
						}),
						(o.prototype.idivn = function (t) {
							e(t <= 67108863);
							for (var r = 0, i = this.length - 1; i >= 0; i--) {
								var n = (0 | this.words[i]) + 67108864 * r;
								(this.words[i] = (n / t) | 0), (r = n % t);
							}
							return this.strip();
						}),
						(o.prototype.divn = function (t) {
							return this.clone().idivn(t);
						}),
						(o.prototype.egcd = function (t) {
							e(0 === t.negative), e(!t.isZero());
							var r = this,
								i = t.clone();
							r = 0 !== r.negative ? r.umod(t) : r.clone();
							for (
								var n = new o(1), s = new o(0), h = new o(0), u = new o(1), a = 0;
								r.isEven() && i.isEven();

							)
								r.iushrn(1), i.iushrn(1), ++a;
							for (var l = i.clone(), f = r.clone(); !r.isZero(); ) {
								for (var m = 0, c = 1; 0 == (r.words[0] & c) && m < 26; ++m, c <<= 1);
								if (m > 0)
									for (r.iushrn(m); m-- > 0; )
										(n.isOdd() || s.isOdd()) && (n.iadd(l), s.isub(f)), n.iushrn(1), s.iushrn(1);
								for (var d = 0, p = 1; 0 == (i.words[0] & p) && d < 26; ++d, p <<= 1);
								if (d > 0)
									for (i.iushrn(d); d-- > 0; )
										(h.isOdd() || u.isOdd()) && (h.iadd(l), u.isub(f)), h.iushrn(1), u.iushrn(1);
								r.cmp(i) >= 0
									? (r.isub(i), n.isub(h), s.isub(u))
									: (i.isub(r), h.isub(n), u.isub(s));
							}
							return { a: h, b: u, gcd: i.iushln(a) };
						}),
						(o.prototype._invmp = function (t) {
							e(0 === t.negative), e(!t.isZero());
							var r = this,
								i = t.clone();
							r = 0 !== r.negative ? r.umod(t) : r.clone();
							for (
								var n, s = new o(1), h = new o(0), u = i.clone();
								r.cmpn(1) > 0 && i.cmpn(1) > 0;

							) {
								for (var a = 0, l = 1; 0 == (r.words[0] & l) && a < 26; ++a, l <<= 1);
								if (a > 0) for (r.iushrn(a); a-- > 0; ) s.isOdd() && s.iadd(u), s.iushrn(1);
								for (var f = 0, m = 1; 0 == (i.words[0] & m) && f < 26; ++f, m <<= 1);
								if (f > 0) for (i.iushrn(f); f-- > 0; ) h.isOdd() && h.iadd(u), h.iushrn(1);
								r.cmp(i) >= 0 ? (r.isub(i), s.isub(h)) : (i.isub(r), h.isub(s));
							}
							return (n = 0 === r.cmpn(1) ? s : h).cmpn(0) < 0 && n.iadd(t), n;
						}),
						(o.prototype.gcd = function (t) {
							if (this.isZero()) return t.abs();
							if (t.isZero()) return this.abs();
							var r = this.clone(),
								i = t.clone();
							(r.negative = 0), (i.negative = 0);
							for (var e = 0; r.isEven() && i.isEven(); e++) r.iushrn(1), i.iushrn(1);
							for (;;) {
								for (; r.isEven(); ) r.iushrn(1);
								for (; i.isEven(); ) i.iushrn(1);
								var n = r.cmp(i);
								if (n < 0) {
									var o = r;
									(r = i), (i = o);
								} else if (0 === n || 0 === i.cmpn(1)) break;
								r.isub(i);
							}
							return i.iushln(e);
						}),
						(o.prototype.invm = function (t) {
							return this.egcd(t).a.umod(t);
						}),
						(o.prototype.isEven = function () {
							return 0 == (1 & this.words[0]);
						}),
						(o.prototype.isOdd = function () {
							return 1 == (1 & this.words[0]);
						}),
						(o.prototype.andln = function (t) {
							return this.words[0] & t;
						}),
						(o.prototype.bincn = function (t) {
							e('number' == typeof t);
							var r = t % 26,
								i = (t - r) / 26,
								n = 1 << r;
							if (this.length <= i) return this._expand(i + 1), (this.words[i] |= n), this;
							for (var o = n, s = i; 0 !== o && s < this.length; s++) {
								var h = 0 | this.words[s];
								(o = (h += o) >>> 26), (h &= 67108863), (this.words[s] = h);
							}
							return 0 !== o && ((this.words[s] = o), this.length++), this;
						}),
						(o.prototype.isZero = function () {
							return 1 === this.length && 0 === this.words[0];
						}),
						(o.prototype.cmpn = function (t) {
							var r,
								i = t < 0;
							if (0 !== this.negative && !i) return -1;
							if (0 === this.negative && i) return 1;
							if ((this.strip(), this.length > 1)) r = 1;
							else {
								i && (t = -t), e(t <= 67108863, 'Number is too big');
								var n = 0 | this.words[0];
								r = n === t ? 0 : n < t ? -1 : 1;
							}
							return 0 !== this.negative ? 0 | -r : r;
						}),
						(o.prototype.cmp = function (t) {
							if (0 !== this.negative && 0 === t.negative) return -1;
							if (0 === this.negative && 0 !== t.negative) return 1;
							var r = this.ucmp(t);
							return 0 !== this.negative ? 0 | -r : r;
						}),
						(o.prototype.ucmp = function (t) {
							if (this.length > t.length) return 1;
							if (this.length < t.length) return -1;
							for (var r = 0, i = this.length - 1; i >= 0; i--) {
								var e = 0 | this.words[i],
									n = 0 | t.words[i];
								if (e !== n) {
									e < n ? (r = -1) : e > n && (r = 1);
									break;
								}
							}
							return r;
						}),
						(o.prototype.gtn = function (t) {
							return 1 === this.cmpn(t);
						}),
						(o.prototype.gt = function (t) {
							return 1 === this.cmp(t);
						}),
						(o.prototype.gten = function (t) {
							return this.cmpn(t) >= 0;
						}),
						(o.prototype.gte = function (t) {
							return this.cmp(t) >= 0;
						}),
						(o.prototype.ltn = function (t) {
							return -1 === this.cmpn(t);
						}),
						(o.prototype.lt = function (t) {
							return -1 === this.cmp(t);
						}),
						(o.prototype.lten = function (t) {
							return this.cmpn(t) <= 0;
						}),
						(o.prototype.lte = function (t) {
							return this.cmp(t) <= 0;
						}),
						(o.prototype.eqn = function (t) {
							return 0 === this.cmpn(t);
						}),
						(o.prototype.eq = function (t) {
							return 0 === this.cmp(t);
						}),
						(o.red = function (t) {
							return new _(t);
						}),
						(o.prototype.toRed = function (t) {
							return (
								e(!this.red, 'Already a number in reduction context'),
								e(0 === this.negative, 'red works only with positives'),
								t.convertTo(this)._forceRed(t)
							);
						}),
						(o.prototype.fromRed = function () {
							return (
								e(this.red, 'fromRed works only with numbers in reduction context'),
								this.red.convertFrom(this)
							);
						}),
						(o.prototype._forceRed = function (t) {
							return (this.red = t), this;
						}),
						(o.prototype.forceRed = function (t) {
							return e(!this.red, 'Already a number in reduction context'), this._forceRed(t);
						}),
						(o.prototype.redAdd = function (t) {
							return e(this.red, 'redAdd works only with red numbers'), this.red.add(this, t);
						}),
						(o.prototype.redIAdd = function (t) {
							return e(this.red, 'redIAdd works only with red numbers'), this.red.iadd(this, t);
						}),
						(o.prototype.redSub = function (t) {
							return e(this.red, 'redSub works only with red numbers'), this.red.sub(this, t);
						}),
						(o.prototype.redISub = function (t) {
							return e(this.red, 'redISub works only with red numbers'), this.red.isub(this, t);
						}),
						(o.prototype.redShl = function (t) {
							return e(this.red, 'redShl works only with red numbers'), this.red.shl(this, t);
						}),
						(o.prototype.redMul = function (t) {
							return (
								e(this.red, 'redMul works only with red numbers'),
								this.red._verify2(this, t),
								this.red.mul(this, t)
							);
						}),
						(o.prototype.redIMul = function (t) {
							return (
								e(this.red, 'redMul works only with red numbers'),
								this.red._verify2(this, t),
								this.red.imul(this, t)
							);
						}),
						(o.prototype.redSqr = function () {
							return (
								e(this.red, 'redSqr works only with red numbers'),
								this.red._verify1(this),
								this.red.sqr(this)
							);
						}),
						(o.prototype.redISqr = function () {
							return (
								e(this.red, 'redISqr works only with red numbers'),
								this.red._verify1(this),
								this.red.isqr(this)
							);
						}),
						(o.prototype.redSqrt = function () {
							return (
								e(this.red, 'redSqrt works only with red numbers'),
								this.red._verify1(this),
								this.red.sqrt(this)
							);
						}),
						(o.prototype.redInvm = function () {
							return (
								e(this.red, 'redInvm works only with red numbers'),
								this.red._verify1(this),
								this.red.invm(this)
							);
						}),
						(o.prototype.redNeg = function () {
							return (
								e(this.red, 'redNeg works only with red numbers'),
								this.red._verify1(this),
								this.red.neg(this)
							);
						}),
						(o.prototype.redPow = function (t) {
							return (
								e(this.red && !t.red, 'redPow(normalNum)'),
								this.red._verify1(this),
								this.red.pow(this, t)
							);
						});
					var g = { k256: null, p224: null, p192: null, p25519: null };
					function v(t, r) {
						(this.name = t),
							(this.p = new o(r, 16)),
							(this.n = this.p.bitLength()),
							(this.k = new o(1).iushln(this.n).isub(this.p)),
							(this.tmp = this._tmp());
					}
					function y() {
						v.call(
							this,
							'k256',
							'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f'
						);
					}
					function w() {
						v.call(this, 'p224', 'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001');
					}
					function M() {
						v.call(this, 'p192', 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff');
					}
					function b() {
						v.call(
							this,
							'25519',
							'7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed'
						);
					}
					function _(t) {
						if ('string' == typeof t) {
							var r = o._prime(t);
							(this.m = r.p), (this.prime = r);
						} else e(t.gtn(1), 'modulus must be greater than 1'), (this.m = t), (this.prime = null);
					}
					function A(t) {
						_.call(this, t),
							(this.shift = this.m.bitLength()),
							this.shift % 26 != 0 && (this.shift += 26 - (this.shift % 26)),
							(this.r = new o(1).iushln(this.shift)),
							(this.r2 = this.imod(this.r.sqr())),
							(this.rinv = this.r._invmp(this.m)),
							(this.minv = this.rinv.mul(this.r).isubn(1).div(this.m)),
							(this.minv = this.minv.umod(this.r)),
							(this.minv = this.r.sub(this.minv));
					}
					(v.prototype._tmp = function () {
						var t = new o(null);
						return (t.words = new Array(Math.ceil(this.n / 13))), t;
					}),
						(v.prototype.ireduce = function (t) {
							var r,
								i = t;
							do {
								this.split(i, this.tmp), (r = (i = (i = this.imulK(i)).iadd(this.tmp)).bitLength());
							} while (r > this.n);
							var e = r < this.n ? -1 : i.ucmp(this.p);
							return (
								0 === e ? ((i.words[0] = 0), (i.length = 1)) : e > 0 ? i.isub(this.p) : i.strip(), i
							);
						}),
						(v.prototype.split = function (t, r) {
							t.iushrn(this.n, 0, r);
						}),
						(v.prototype.imulK = function (t) {
							return t.imul(this.k);
						}),
						n(y, v),
						(y.prototype.split = function (t, r) {
							for (var i = Math.min(t.length, 9), e = 0; e < i; e++) r.words[e] = t.words[e];
							if (((r.length = i), t.length <= 9)) return (t.words[0] = 0), void (t.length = 1);
							var n = t.words[9];
							for (r.words[r.length++] = 4194303 & n, e = 10; e < t.length; e++) {
								var o = 0 | t.words[e];
								(t.words[e - 10] = ((4194303 & o) << 4) | (n >>> 22)), (n = o);
							}
							(n >>>= 22),
								(t.words[e - 10] = n),
								0 === n && t.length > 10 ? (t.length -= 10) : (t.length -= 9);
						}),
						(y.prototype.imulK = function (t) {
							(t.words[t.length] = 0), (t.words[t.length + 1] = 0), (t.length += 2);
							for (var r = 0, i = 0; i < t.length; i++) {
								var e = 0 | t.words[i];
								(r += 977 * e), (t.words[i] = 67108863 & r), (r = 64 * e + ((r / 67108864) | 0));
							}
							return (
								0 === t.words[t.length - 1] &&
									(t.length--, 0 === t.words[t.length - 1] && t.length--),
								t
							);
						}),
						n(w, v),
						n(M, v),
						n(b, v),
						(b.prototype.imulK = function (t) {
							for (var r = 0, i = 0; i < t.length; i++) {
								var e = 19 * (0 | t.words[i]) + r,
									n = 67108863 & e;
								(e >>>= 26), (t.words[i] = n), (r = e);
							}
							return 0 !== r && (t.words[t.length++] = r), t;
						}),
						(o._prime = function (t) {
							if (g[t]) return g[t];
							var r;
							if ('k256' === t) r = new y();
							else if ('p224' === t) r = new w();
							else if ('p192' === t) r = new M();
							else {
								if ('p25519' !== t) throw new Error('Unknown prime ' + t);
								r = new b();
							}
							return (g[t] = r), r;
						}),
						(_.prototype._verify1 = function (t) {
							e(0 === t.negative, 'red works only with positives'),
								e(t.red, 'red works only with red numbers');
						}),
						(_.prototype._verify2 = function (t, r) {
							e(0 == (t.negative | r.negative), 'red works only with positives'),
								e(t.red && t.red === r.red, 'red works only with red numbers');
						}),
						(_.prototype.imod = function (t) {
							return this.prime
								? this.prime.ireduce(t)._forceRed(this)
								: t.umod(this.m)._forceRed(this);
						}),
						(_.prototype.neg = function (t) {
							return t.isZero() ? t.clone() : this.m.sub(t)._forceRed(this);
						}),
						(_.prototype.add = function (t, r) {
							this._verify2(t, r);
							var i = t.add(r);
							return i.cmp(this.m) >= 0 && i.isub(this.m), i._forceRed(this);
						}),
						(_.prototype.iadd = function (t, r) {
							this._verify2(t, r);
							var i = t.iadd(r);
							return i.cmp(this.m) >= 0 && i.isub(this.m), i;
						}),
						(_.prototype.sub = function (t, r) {
							this._verify2(t, r);
							var i = t.sub(r);
							return i.cmpn(0) < 0 && i.iadd(this.m), i._forceRed(this);
						}),
						(_.prototype.isub = function (t, r) {
							this._verify2(t, r);
							var i = t.isub(r);
							return i.cmpn(0) < 0 && i.iadd(this.m), i;
						}),
						(_.prototype.shl = function (t, r) {
							return this._verify1(t), this.imod(t.ushln(r));
						}),
						(_.prototype.imul = function (t, r) {
							return this._verify2(t, r), this.imod(t.imul(r));
						}),
						(_.prototype.mul = function (t, r) {
							return this._verify2(t, r), this.imod(t.mul(r));
						}),
						(_.prototype.isqr = function (t) {
							return this.imul(t, t.clone());
						}),
						(_.prototype.sqr = function (t) {
							return this.mul(t, t);
						}),
						(_.prototype.sqrt = function (t) {
							if (t.isZero()) return t.clone();
							var r = this.m.andln(3);
							if ((e(r % 2 == 1), 3 === r)) {
								var i = this.m.add(new o(1)).iushrn(2);
								return this.pow(t, i);
							}
							for (var n = this.m.subn(1), s = 0; !n.isZero() && 0 === n.andln(1); )
								s++, n.iushrn(1);
							e(!n.isZero());
							var h = new o(1).toRed(this),
								u = h.redNeg(),
								a = this.m.subn(1).iushrn(1),
								l = this.m.bitLength();
							for (l = new o(2 * l * l).toRed(this); 0 !== this.pow(l, a).cmp(u); ) l.redIAdd(u);
							for (
								var f = this.pow(l, n),
									m = this.pow(t, n.addn(1).iushrn(1)),
									c = this.pow(t, n),
									d = s;
								0 !== c.cmp(h);

							) {
								for (var p = c, g = 0; 0 !== p.cmp(h); g++) p = p.redSqr();
								e(g < d);
								var v = this.pow(f, new o(1).iushln(d - g - 1));
								(m = m.redMul(v)), (f = v.redSqr()), (c = c.redMul(f)), (d = g);
							}
							return m;
						}),
						(_.prototype.invm = function (t) {
							var r = t._invmp(this.m);
							return 0 !== r.negative ? ((r.negative = 0), this.imod(r).redNeg()) : this.imod(r);
						}),
						(_.prototype.pow = function (t, r) {
							if (r.isZero()) return new o(1);
							if (0 === r.cmpn(1)) return t.clone();
							var i = new Array(16);
							(i[0] = new o(1).toRed(this)), (i[1] = t);
							for (var e = 2; e < i.length; e++) i[e] = this.mul(i[e - 1], t);
							var n = i[0],
								s = 0,
								h = 0,
								u = r.bitLength() % 26;
							for (0 === u && (u = 26), e = r.length - 1; e >= 0; e--) {
								for (var a = r.words[e], l = u - 1; l >= 0; l--) {
									var f = (a >> l) & 1;
									n !== i[0] && (n = this.sqr(n)),
										0 !== f || 0 !== s
											? ((s <<= 1),
											  (s |= f),
											  (4 === ++h || (0 === e && 0 === l)) &&
													((n = this.mul(n, i[s])), (h = 0), (s = 0)))
											: (h = 0);
								}
								u = 26;
							}
							return n;
						}),
						(_.prototype.convertTo = function (t) {
							var r = t.umod(this.m);
							return r === t ? r.clone() : r;
						}),
						(_.prototype.convertFrom = function (t) {
							var r = t.clone();
							return (r.red = null), r;
						}),
						(o.mont = function (t) {
							return new A(t);
						}),
						n(A, _),
						(A.prototype.convertTo = function (t) {
							return this.imod(t.ushln(this.shift));
						}),
						(A.prototype.convertFrom = function (t) {
							var r = this.imod(t.mul(this.rinv));
							return (r.red = null), r;
						}),
						(A.prototype.imul = function (t, r) {
							if (t.isZero() || r.isZero()) return (t.words[0] = 0), (t.length = 1), t;
							var i = t.imul(r),
								e = i.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
								n = i.isub(e).iushrn(this.shift),
								o = n;
							return (
								n.cmp(this.m) >= 0 ? (o = n.isub(this.m)) : n.cmpn(0) < 0 && (o = n.iadd(this.m)),
								o._forceRed(this)
							);
						}),
						(A.prototype.mul = function (t, r) {
							if (t.isZero() || r.isZero()) return new o(0)._forceRed(this);
							var i = t.mul(r),
								e = i.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
								n = i.isub(e).iushrn(this.shift),
								s = n;
							return (
								n.cmp(this.m) >= 0 ? (s = n.isub(this.m)) : n.cmpn(0) < 0 && (s = n.iadd(this.m)),
								s._forceRed(this)
							);
						}),
						(A.prototype.invm = function (t) {
							return this.imod(t._invmp(this.m).mul(this.r2))._forceRed(this);
						});
				})(t, this);
			}.call(this, i(0)(t)));
		},
		function (t, r, i) {
			'use strict';
			(r.byteLength = function (t) {
				var r = a(t),
					i = r[0],
					e = r[1];
				return (3 * (i + e)) / 4 - e;
			}),
				(r.toByteArray = function (t) {
					var r,
						i,
						e = a(t),
						s = e[0],
						h = e[1],
						u = new o(
							(function (t, r, i) {
								return (3 * (r + i)) / 4 - i;
							})(0, s, h)
						),
						l = 0,
						f = h > 0 ? s - 4 : s;
					for (i = 0; i < f; i += 4)
						(r =
							(n[t.charCodeAt(i)] << 18) |
							(n[t.charCodeAt(i + 1)] << 12) |
							(n[t.charCodeAt(i + 2)] << 6) |
							n[t.charCodeAt(i + 3)]),
							(u[l++] = (r >> 16) & 255),
							(u[l++] = (r >> 8) & 255),
							(u[l++] = 255 & r);
					2 === h &&
						((r = (n[t.charCodeAt(i)] << 2) | (n[t.charCodeAt(i + 1)] >> 4)), (u[l++] = 255 & r));
					1 === h &&
						((r =
							(n[t.charCodeAt(i)] << 10) |
							(n[t.charCodeAt(i + 1)] << 4) |
							(n[t.charCodeAt(i + 2)] >> 2)),
						(u[l++] = (r >> 8) & 255),
						(u[l++] = 255 & r));
					return u;
				}),
				(r.fromByteArray = function (t) {
					for (var r, i = t.length, n = i % 3, o = [], s = 0, h = i - n; s < h; s += 16383)
						o.push(l(t, s, s + 16383 > h ? h : s + 16383));
					1 === n
						? ((r = t[i - 1]), o.push(e[r >> 2] + e[(r << 4) & 63] + '=='))
						: 2 === n &&
						  ((r = (t[i - 2] << 8) + t[i - 1]),
						  o.push(e[r >> 10] + e[(r >> 4) & 63] + e[(r << 2) & 63] + '='));
					return o.join('');
				});
			for (
				var e = [],
					n = [],
					o = 'undefined' != typeof Uint8Array ? Uint8Array : Array,
					s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
					h = 0,
					u = s.length;
				h < u;
				++h
			)
				(e[h] = s[h]), (n[s.charCodeAt(h)] = h);
			function a(t) {
				var r = t.length;
				if (r % 4 > 0) throw new Error('Invalid string. Length must be a multiple of 4');
				var i = t.indexOf('=');
				return -1 === i && (i = r), [i, i === r ? 0 : 4 - (i % 4)];
			}
			function l(t, r, i) {
				for (var n, o, s = [], h = r; h < i; h += 3)
					(n = ((t[h] << 16) & 16711680) + ((t[h + 1] << 8) & 65280) + (255 & t[h + 2])),
						s.push(e[((o = n) >> 18) & 63] + e[(o >> 12) & 63] + e[(o >> 6) & 63] + e[63 & o]);
				return s.join('');
			}
			(n['-'.charCodeAt(0)] = 62), (n['_'.charCodeAt(0)] = 63);
		},
		function (t, r) {
			/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
			(r.read = function (t, r, i, e, n) {
				var o,
					s,
					h = 8 * n - e - 1,
					u = (1 << h) - 1,
					a = u >> 1,
					l = -7,
					f = i ? n - 1 : 0,
					m = i ? -1 : 1,
					c = t[r + f];
				for (
					f += m, o = c & ((1 << -l) - 1), c >>= -l, l += h;
					l > 0;
					o = 256 * o + t[r + f], f += m, l -= 8
				);
				for (
					s = o & ((1 << -l) - 1), o >>= -l, l += e;
					l > 0;
					s = 256 * s + t[r + f], f += m, l -= 8
				);
				if (0 === o) o = 1 - a;
				else {
					if (o === u) return s ? NaN : (1 / 0) * (c ? -1 : 1);
					(s += Math.pow(2, e)), (o -= a);
				}
				return (c ? -1 : 1) * s * Math.pow(2, o - e);
			}),
				(r.write = function (t, r, i, e, n, o) {
					var s,
						h,
						u,
						a = 8 * o - n - 1,
						l = (1 << a) - 1,
						f = l >> 1,
						m = 23 === n ? Math.pow(2, -24) - Math.pow(2, -77) : 0,
						c = e ? 0 : o - 1,
						d = e ? 1 : -1,
						p = r < 0 || (0 === r && 1 / r < 0) ? 1 : 0;
					for (
						r = Math.abs(r),
							isNaN(r) || r === 1 / 0
								? ((h = isNaN(r) ? 1 : 0), (s = l))
								: ((s = Math.floor(Math.log(r) / Math.LN2)),
								  r * (u = Math.pow(2, -s)) < 1 && (s--, (u *= 2)),
								  (r += s + f >= 1 ? m / u : m * Math.pow(2, 1 - f)) * u >= 2 && (s++, (u /= 2)),
								  s + f >= l
										? ((h = 0), (s = l))
										: s + f >= 1
										? ((h = (r * u - 1) * Math.pow(2, n)), (s += f))
										: ((h = r * Math.pow(2, f - 1) * Math.pow(2, n)), (s = 0)));
						n >= 8;
						t[i + c] = 255 & h, c += d, h /= 256, n -= 8
					);
					for (s = (s << n) | h, a += n; a > 0; t[i + c] = 255 & s, c += d, s /= 256, a -= 8);
					t[i + c - d] |= 128 * p;
				});
		},
		function (t, r) {
			var i = {}.toString;
			t.exports =
				Array.isArray ||
				function (t) {
					return '[object Array]' == i.call(t);
				};
		},
		function (t, r, i) {
			(function (t) {
				!(function (t, r) {
					'use strict';
					function e(t, r) {
						if (!t) throw new Error(r || 'Assertion failed');
					}
					function n(t, r) {
						t.super_ = r;
						var i = function () {};
						(i.prototype = r.prototype), (t.prototype = new i()), (t.prototype.constructor = t);
					}
					function o(t, r, i) {
						if (o.isBN(t)) return t;
						(this.negative = 0),
							(this.words = null),
							(this.length = 0),
							(this.red = null),
							null !== t &&
								(('le' !== r && 'be' !== r) || ((i = r), (r = 10)),
								this._init(t || 0, r || 10, i || 'be'));
					}
					var s;
					'object' == typeof t ? (t.exports = o) : (r.BN = o), (o.BN = o), (o.wordSize = 26);
					try {
						s = i(1).Buffer;
					} catch (t) {}
					function h(t, r, i) {
						for (var e = 0, n = Math.min(t.length, i), o = r; o < n; o++) {
							var s = t.charCodeAt(o) - 48;
							(e <<= 4),
								(e |= s >= 49 && s <= 54 ? s - 49 + 10 : s >= 17 && s <= 22 ? s - 17 + 10 : 15 & s);
						}
						return e;
					}
					function u(t, r, i, e) {
						for (var n = 0, o = Math.min(t.length, i), s = r; s < o; s++) {
							var h = t.charCodeAt(s) - 48;
							(n *= e), (n += h >= 49 ? h - 49 + 10 : h >= 17 ? h - 17 + 10 : h);
						}
						return n;
					}
					(o.isBN = function (t) {
						return (
							t instanceof o ||
							(null !== t &&
								'object' == typeof t &&
								t.constructor.wordSize === o.wordSize &&
								Array.isArray(t.words))
						);
					}),
						(o.max = function (t, r) {
							return t.cmp(r) > 0 ? t : r;
						}),
						(o.min = function (t, r) {
							return t.cmp(r) < 0 ? t : r;
						}),
						(o.prototype._init = function (t, r, i) {
							if ('number' == typeof t) return this._initNumber(t, r, i);
							if ('object' == typeof t) return this._initArray(t, r, i);
							'hex' === r && (r = 16), e(r === (0 | r) && r >= 2 && r <= 36);
							var n = 0;
							'-' === (t = t.toString().replace(/\s+/g, ''))[0] && n++,
								16 === r ? this._parseHex(t, n) : this._parseBase(t, r, n),
								'-' === t[0] && (this.negative = 1),
								this.strip(),
								'le' === i && this._initArray(this.toArray(), r, i);
						}),
						(o.prototype._initNumber = function (t, r, i) {
							t < 0 && ((this.negative = 1), (t = -t)),
								t < 67108864
									? ((this.words = [67108863 & t]), (this.length = 1))
									: t < 4503599627370496
									? ((this.words = [67108863 & t, (t / 67108864) & 67108863]), (this.length = 2))
									: (e(t < 9007199254740992),
									  (this.words = [67108863 & t, (t / 67108864) & 67108863, 1]),
									  (this.length = 3)),
								'le' === i && this._initArray(this.toArray(), r, i);
						}),
						(o.prototype._initArray = function (t, r, i) {
							if ((e('number' == typeof t.length), t.length <= 0))
								return (this.words = [0]), (this.length = 1), this;
							(this.length = Math.ceil(t.length / 3)), (this.words = new Array(this.length));
							for (var n = 0; n < this.length; n++) this.words[n] = 0;
							var o,
								s,
								h = 0;
							if ('be' === i)
								for (n = t.length - 1, o = 0; n >= 0; n -= 3)
									(s = t[n] | (t[n - 1] << 8) | (t[n - 2] << 16)),
										(this.words[o] |= (s << h) & 67108863),
										(this.words[o + 1] = (s >>> (26 - h)) & 67108863),
										(h += 24) >= 26 && ((h -= 26), o++);
							else if ('le' === i)
								for (n = 0, o = 0; n < t.length; n += 3)
									(s = t[n] | (t[n + 1] << 8) | (t[n + 2] << 16)),
										(this.words[o] |= (s << h) & 67108863),
										(this.words[o + 1] = (s >>> (26 - h)) & 67108863),
										(h += 24) >= 26 && ((h -= 26), o++);
							return this.strip();
						}),
						(o.prototype._parseHex = function (t, r) {
							(this.length = Math.ceil((t.length - r) / 6)), (this.words = new Array(this.length));
							for (var i = 0; i < this.length; i++) this.words[i] = 0;
							var e,
								n,
								o = 0;
							for (i = t.length - 6, e = 0; i >= r; i -= 6)
								(n = h(t, i, i + 6)),
									(this.words[e] |= (n << o) & 67108863),
									(this.words[e + 1] |= (n >>> (26 - o)) & 4194303),
									(o += 24) >= 26 && ((o -= 26), e++);
							i + 6 !== r &&
								((n = h(t, r, i + 6)),
								(this.words[e] |= (n << o) & 67108863),
								(this.words[e + 1] |= (n >>> (26 - o)) & 4194303)),
								this.strip();
						}),
						(o.prototype._parseBase = function (t, r, i) {
							(this.words = [0]), (this.length = 1);
							for (var e = 0, n = 1; n <= 67108863; n *= r) e++;
							e--, (n = (n / r) | 0);
							for (
								var o = t.length - i, s = o % e, h = Math.min(o, o - s) + i, a = 0, l = i;
								l < h;
								l += e
							)
								(a = u(t, l, l + e, r)),
									this.imuln(n),
									this.words[0] + a < 67108864 ? (this.words[0] += a) : this._iaddn(a);
							if (0 !== s) {
								var f = 1;
								for (a = u(t, l, t.length, r), l = 0; l < s; l++) f *= r;
								this.imuln(f), this.words[0] + a < 67108864 ? (this.words[0] += a) : this._iaddn(a);
							}
						}),
						(o.prototype.copy = function (t) {
							t.words = new Array(this.length);
							for (var r = 0; r < this.length; r++) t.words[r] = this.words[r];
							(t.length = this.length), (t.negative = this.negative), (t.red = this.red);
						}),
						(o.prototype.clone = function () {
							var t = new o(null);
							return this.copy(t), t;
						}),
						(o.prototype._expand = function (t) {
							for (; this.length < t; ) this.words[this.length++] = 0;
							return this;
						}),
						(o.prototype.strip = function () {
							for (; this.length > 1 && 0 === this.words[this.length - 1]; ) this.length--;
							return this._normSign();
						}),
						(o.prototype._normSign = function () {
							return 1 === this.length && 0 === this.words[0] && (this.negative = 0), this;
						}),
						(o.prototype.inspect = function () {
							return (this.red ? '<BN-R: ' : '<BN: ') + this.toString(16) + '>';
						});
					var a = [
							'',
							'0',
							'00',
							'000',
							'0000',
							'00000',
							'000000',
							'0000000',
							'00000000',
							'000000000',
							'0000000000',
							'00000000000',
							'000000000000',
							'0000000000000',
							'00000000000000',
							'000000000000000',
							'0000000000000000',
							'00000000000000000',
							'000000000000000000',
							'0000000000000000000',
							'00000000000000000000',
							'000000000000000000000',
							'0000000000000000000000',
							'00000000000000000000000',
							'000000000000000000000000',
							'0000000000000000000000000',
						],
						l = [
							0, 0, 25, 16, 12, 11, 10, 9, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5,
							5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
						],
						f = [
							0, 0, 33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216, 43046721,
							1e7, 19487171, 35831808, 62748517, 7529536, 11390625, 16777216, 24137569, 34012224,
							47045881, 64e6, 4084101, 5153632, 6436343, 7962624, 9765625, 11881376, 14348907,
							17210368, 20511149, 243e5, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176,
						];
					function m(t, r, i) {
						i.negative = r.negative ^ t.negative;
						var e = (t.length + r.length) | 0;
						(i.length = e), (e = (e - 1) | 0);
						var n = 0 | t.words[0],
							o = 0 | r.words[0],
							s = n * o,
							h = 67108863 & s,
							u = (s / 67108864) | 0;
						i.words[0] = h;
						for (var a = 1; a < e; a++) {
							for (
								var l = u >>> 26,
									f = 67108863 & u,
									m = Math.min(a, r.length - 1),
									c = Math.max(0, a - t.length + 1);
								c <= m;
								c++
							) {
								var d = (a - c) | 0;
								(l += ((s = (n = 0 | t.words[d]) * (o = 0 | r.words[c]) + f) / 67108864) | 0),
									(f = 67108863 & s);
							}
							(i.words[a] = 0 | f), (u = 0 | l);
						}
						return 0 !== u ? (i.words[a] = 0 | u) : i.length--, i.strip();
					}
					(o.prototype.toString = function (t, r) {
						var i;
						if (((r = 0 | r || 1), 16 === (t = t || 10) || 'hex' === t)) {
							i = '';
							for (var n = 0, o = 0, s = 0; s < this.length; s++) {
								var h = this.words[s],
									u = (16777215 & ((h << n) | o)).toString(16);
								(i =
									0 !== (o = (h >>> (24 - n)) & 16777215) || s !== this.length - 1
										? a[6 - u.length] + u + i
										: u + i),
									(n += 2) >= 26 && ((n -= 26), s--);
							}
							for (0 !== o && (i = o.toString(16) + i); i.length % r != 0; ) i = '0' + i;
							return 0 !== this.negative && (i = '-' + i), i;
						}
						if (t === (0 | t) && t >= 2 && t <= 36) {
							var m = l[t],
								c = f[t];
							i = '';
							var d = this.clone();
							for (d.negative = 0; !d.isZero(); ) {
								var p = d.modn(c).toString(t);
								i = (d = d.idivn(c)).isZero() ? p + i : a[m - p.length] + p + i;
							}
							for (this.isZero() && (i = '0' + i); i.length % r != 0; ) i = '0' + i;
							return 0 !== this.negative && (i = '-' + i), i;
						}
						e(!1, 'Base should be between 2 and 36');
					}),
						(o.prototype.toNumber = function () {
							var t = this.words[0];
							return (
								2 === this.length
									? (t += 67108864 * this.words[1])
									: 3 === this.length && 1 === this.words[2]
									? (t += 4503599627370496 + 67108864 * this.words[1])
									: this.length > 2 && e(!1, 'Number can only safely store up to 53 bits'),
								0 !== this.negative ? -t : t
							);
						}),
						(o.prototype.toJSON = function () {
							return this.toString(16);
						}),
						(o.prototype.toBuffer = function (t, r) {
							return e(void 0 !== s), this.toArrayLike(s, t, r);
						}),
						(o.prototype.toArray = function (t, r) {
							return this.toArrayLike(Array, t, r);
						}),
						(o.prototype.toArrayLike = function (t, r, i) {
							var n = this.byteLength(),
								o = i || Math.max(1, n);
							e(n <= o, 'byte array longer than desired length'),
								e(o > 0, 'Requested array length <= 0'),
								this.strip();
							var s,
								h,
								u = 'le' === r,
								a = new t(o),
								l = this.clone();
							if (u) {
								for (h = 0; !l.isZero(); h++) (s = l.andln(255)), l.iushrn(8), (a[h] = s);
								for (; h < o; h++) a[h] = 0;
							} else {
								for (h = 0; h < o - n; h++) a[h] = 0;
								for (h = 0; !l.isZero(); h++) (s = l.andln(255)), l.iushrn(8), (a[o - h - 1] = s);
							}
							return a;
						}),
						Math.clz32
							? (o.prototype._countBits = function (t) {
									return 32 - Math.clz32(t);
							  })
							: (o.prototype._countBits = function (t) {
									var r = t,
										i = 0;
									return (
										r >= 4096 && ((i += 13), (r >>>= 13)),
										r >= 64 && ((i += 7), (r >>>= 7)),
										r >= 8 && ((i += 4), (r >>>= 4)),
										r >= 2 && ((i += 2), (r >>>= 2)),
										i + r
									);
							  }),
						(o.prototype._zeroBits = function (t) {
							if (0 === t) return 26;
							var r = t,
								i = 0;
							return (
								0 == (8191 & r) && ((i += 13), (r >>>= 13)),
								0 == (127 & r) && ((i += 7), (r >>>= 7)),
								0 == (15 & r) && ((i += 4), (r >>>= 4)),
								0 == (3 & r) && ((i += 2), (r >>>= 2)),
								0 == (1 & r) && i++,
								i
							);
						}),
						(o.prototype.bitLength = function () {
							var t = this.words[this.length - 1],
								r = this._countBits(t);
							return 26 * (this.length - 1) + r;
						}),
						(o.prototype.zeroBits = function () {
							if (this.isZero()) return 0;
							for (var t = 0, r = 0; r < this.length; r++) {
								var i = this._zeroBits(this.words[r]);
								if (((t += i), 26 !== i)) break;
							}
							return t;
						}),
						(o.prototype.byteLength = function () {
							return Math.ceil(this.bitLength() / 8);
						}),
						(o.prototype.toTwos = function (t) {
							return 0 !== this.negative ? this.abs().inotn(t).iaddn(1) : this.clone();
						}),
						(o.prototype.fromTwos = function (t) {
							return this.testn(t - 1) ? this.notn(t).iaddn(1).ineg() : this.clone();
						}),
						(o.prototype.isNeg = function () {
							return 0 !== this.negative;
						}),
						(o.prototype.neg = function () {
							return this.clone().ineg();
						}),
						(o.prototype.ineg = function () {
							return this.isZero() || (this.negative ^= 1), this;
						}),
						(o.prototype.iuor = function (t) {
							for (; this.length < t.length; ) this.words[this.length++] = 0;
							for (var r = 0; r < t.length; r++) this.words[r] = this.words[r] | t.words[r];
							return this.strip();
						}),
						(o.prototype.ior = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuor(t);
						}),
						(o.prototype.or = function (t) {
							return this.length > t.length ? this.clone().ior(t) : t.clone().ior(this);
						}),
						(o.prototype.uor = function (t) {
							return this.length > t.length ? this.clone().iuor(t) : t.clone().iuor(this);
						}),
						(o.prototype.iuand = function (t) {
							var r;
							r = this.length > t.length ? t : this;
							for (var i = 0; i < r.length; i++) this.words[i] = this.words[i] & t.words[i];
							return (this.length = r.length), this.strip();
						}),
						(o.prototype.iand = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuand(t);
						}),
						(o.prototype.and = function (t) {
							return this.length > t.length ? this.clone().iand(t) : t.clone().iand(this);
						}),
						(o.prototype.uand = function (t) {
							return this.length > t.length ? this.clone().iuand(t) : t.clone().iuand(this);
						}),
						(o.prototype.iuxor = function (t) {
							var r, i;
							this.length > t.length ? ((r = this), (i = t)) : ((r = t), (i = this));
							for (var e = 0; e < i.length; e++) this.words[e] = r.words[e] ^ i.words[e];
							if (this !== r) for (; e < r.length; e++) this.words[e] = r.words[e];
							return (this.length = r.length), this.strip();
						}),
						(o.prototype.ixor = function (t) {
							return e(0 == (this.negative | t.negative)), this.iuxor(t);
						}),
						(o.prototype.xor = function (t) {
							return this.length > t.length ? this.clone().ixor(t) : t.clone().ixor(this);
						}),
						(o.prototype.uxor = function (t) {
							return this.length > t.length ? this.clone().iuxor(t) : t.clone().iuxor(this);
						}),
						(o.prototype.inotn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = 0 | Math.ceil(t / 26),
								i = t % 26;
							this._expand(r), i > 0 && r--;
							for (var n = 0; n < r; n++) this.words[n] = 67108863 & ~this.words[n];
							return (
								i > 0 && (this.words[n] = ~this.words[n] & (67108863 >> (26 - i))), this.strip()
							);
						}),
						(o.prototype.notn = function (t) {
							return this.clone().inotn(t);
						}),
						(o.prototype.setn = function (t, r) {
							e('number' == typeof t && t >= 0);
							var i = (t / 26) | 0,
								n = t % 26;
							return (
								this._expand(i + 1),
								(this.words[i] = r ? this.words[i] | (1 << n) : this.words[i] & ~(1 << n)),
								this.strip()
							);
						}),
						(o.prototype.iadd = function (t) {
							var r, i, e;
							if (0 !== this.negative && 0 === t.negative)
								return (
									(this.negative = 0), (r = this.isub(t)), (this.negative ^= 1), this._normSign()
								);
							if (0 === this.negative && 0 !== t.negative)
								return (t.negative = 0), (r = this.isub(t)), (t.negative = 1), r._normSign();
							this.length > t.length ? ((i = this), (e = t)) : ((i = t), (e = this));
							for (var n = 0, o = 0; o < e.length; o++)
								(r = (0 | i.words[o]) + (0 | e.words[o]) + n),
									(this.words[o] = 67108863 & r),
									(n = r >>> 26);
							for (; 0 !== n && o < i.length; o++)
								(r = (0 | i.words[o]) + n), (this.words[o] = 67108863 & r), (n = r >>> 26);
							if (((this.length = i.length), 0 !== n)) (this.words[this.length] = n), this.length++;
							else if (i !== this) for (; o < i.length; o++) this.words[o] = i.words[o];
							return this;
						}),
						(o.prototype.add = function (t) {
							var r;
							return 0 !== t.negative && 0 === this.negative
								? ((t.negative = 0), (r = this.sub(t)), (t.negative ^= 1), r)
								: 0 === t.negative && 0 !== this.negative
								? ((this.negative = 0), (r = t.sub(this)), (this.negative = 1), r)
								: this.length > t.length
								? this.clone().iadd(t)
								: t.clone().iadd(this);
						}),
						(o.prototype.isub = function (t) {
							if (0 !== t.negative) {
								t.negative = 0;
								var r = this.iadd(t);
								return (t.negative = 1), r._normSign();
							}
							if (0 !== this.negative)
								return (this.negative = 0), this.iadd(t), (this.negative = 1), this._normSign();
							var i,
								e,
								n = this.cmp(t);
							if (0 === n) return (this.negative = 0), (this.length = 1), (this.words[0] = 0), this;
							n > 0 ? ((i = this), (e = t)) : ((i = t), (e = this));
							for (var o = 0, s = 0; s < e.length; s++)
								(o = (r = (0 | i.words[s]) - (0 | e.words[s]) + o) >> 26),
									(this.words[s] = 67108863 & r);
							for (; 0 !== o && s < i.length; s++)
								(o = (r = (0 | i.words[s]) + o) >> 26), (this.words[s] = 67108863 & r);
							if (0 === o && s < i.length && i !== this)
								for (; s < i.length; s++) this.words[s] = i.words[s];
							return (
								(this.length = Math.max(this.length, s)),
								i !== this && (this.negative = 1),
								this.strip()
							);
						}),
						(o.prototype.sub = function (t) {
							return this.clone().isub(t);
						});
					var c = function (t, r, i) {
						var e,
							n,
							o,
							s = t.words,
							h = r.words,
							u = i.words,
							a = 0,
							l = 0 | s[0],
							f = 8191 & l,
							m = l >>> 13,
							c = 0 | s[1],
							d = 8191 & c,
							p = c >>> 13,
							g = 0 | s[2],
							v = 8191 & g,
							y = g >>> 13,
							w = 0 | s[3],
							M = 8191 & w,
							b = w >>> 13,
							_ = 0 | s[4],
							A = 8191 & _,
							E = _ >>> 13,
							x = 0 | s[5],
							S = 8191 & x,
							N = x >>> 13,
							T = 0 | s[6],
							R = 8191 & T,
							k = T >>> 13,
							I = 0 | s[7],
							B = 8191 & I,
							O = I >>> 13,
							C = 0 | s[8],
							L = 8191 & C,
							j = C >>> 13,
							P = 0 | s[9],
							U = 8191 & P,
							F = P >>> 13,
							D = 0 | h[0],
							Z = 8191 & D,
							z = D >>> 13,
							q = 0 | h[1],
							H = 8191 & q,
							W = q >>> 13,
							G = 0 | h[2],
							Y = 8191 & G,
							$ = G >>> 13,
							V = 0 | h[3],
							J = 8191 & V,
							K = V >>> 13,
							X = 0 | h[4],
							Q = 8191 & X,
							tt = X >>> 13,
							rt = 0 | h[5],
							it = 8191 & rt,
							et = rt >>> 13,
							nt = 0 | h[6],
							ot = 8191 & nt,
							st = nt >>> 13,
							ht = 0 | h[7],
							ut = 8191 & ht,
							at = ht >>> 13,
							lt = 0 | h[8],
							ft = 8191 & lt,
							mt = lt >>> 13,
							ct = 0 | h[9],
							dt = 8191 & ct,
							pt = ct >>> 13;
						(i.negative = t.negative ^ r.negative), (i.length = 19);
						var gt =
							(((a + (e = Math.imul(f, Z))) | 0) +
								((8191 & (n = ((n = Math.imul(f, z)) + Math.imul(m, Z)) | 0)) << 13)) |
							0;
						(a = ((((o = Math.imul(m, z)) + (n >>> 13)) | 0) + (gt >>> 26)) | 0),
							(gt &= 67108863),
							(e = Math.imul(d, Z)),
							(n = ((n = Math.imul(d, z)) + Math.imul(p, Z)) | 0),
							(o = Math.imul(p, z));
						var vt =
							(((a + (e = (e + Math.imul(f, H)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, W)) | 0) + Math.imul(m, H)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, W)) | 0) + (n >>> 13)) | 0) + (vt >>> 26)) | 0),
							(vt &= 67108863),
							(e = Math.imul(v, Z)),
							(n = ((n = Math.imul(v, z)) + Math.imul(y, Z)) | 0),
							(o = Math.imul(y, z)),
							(e = (e + Math.imul(d, H)) | 0),
							(n = ((n = (n + Math.imul(d, W)) | 0) + Math.imul(p, H)) | 0),
							(o = (o + Math.imul(p, W)) | 0);
						var yt =
							(((a + (e = (e + Math.imul(f, Y)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, $)) | 0) + Math.imul(m, Y)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, $)) | 0) + (n >>> 13)) | 0) + (yt >>> 26)) | 0),
							(yt &= 67108863),
							(e = Math.imul(M, Z)),
							(n = ((n = Math.imul(M, z)) + Math.imul(b, Z)) | 0),
							(o = Math.imul(b, z)),
							(e = (e + Math.imul(v, H)) | 0),
							(n = ((n = (n + Math.imul(v, W)) | 0) + Math.imul(y, H)) | 0),
							(o = (o + Math.imul(y, W)) | 0),
							(e = (e + Math.imul(d, Y)) | 0),
							(n = ((n = (n + Math.imul(d, $)) | 0) + Math.imul(p, Y)) | 0),
							(o = (o + Math.imul(p, $)) | 0);
						var wt =
							(((a + (e = (e + Math.imul(f, J)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, K)) | 0) + Math.imul(m, J)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, K)) | 0) + (n >>> 13)) | 0) + (wt >>> 26)) | 0),
							(wt &= 67108863),
							(e = Math.imul(A, Z)),
							(n = ((n = Math.imul(A, z)) + Math.imul(E, Z)) | 0),
							(o = Math.imul(E, z)),
							(e = (e + Math.imul(M, H)) | 0),
							(n = ((n = (n + Math.imul(M, W)) | 0) + Math.imul(b, H)) | 0),
							(o = (o + Math.imul(b, W)) | 0),
							(e = (e + Math.imul(v, Y)) | 0),
							(n = ((n = (n + Math.imul(v, $)) | 0) + Math.imul(y, Y)) | 0),
							(o = (o + Math.imul(y, $)) | 0),
							(e = (e + Math.imul(d, J)) | 0),
							(n = ((n = (n + Math.imul(d, K)) | 0) + Math.imul(p, J)) | 0),
							(o = (o + Math.imul(p, K)) | 0);
						var Mt =
							(((a + (e = (e + Math.imul(f, Q)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, tt)) | 0) + Math.imul(m, Q)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, tt)) | 0) + (n >>> 13)) | 0) + (Mt >>> 26)) | 0),
							(Mt &= 67108863),
							(e = Math.imul(S, Z)),
							(n = ((n = Math.imul(S, z)) + Math.imul(N, Z)) | 0),
							(o = Math.imul(N, z)),
							(e = (e + Math.imul(A, H)) | 0),
							(n = ((n = (n + Math.imul(A, W)) | 0) + Math.imul(E, H)) | 0),
							(o = (o + Math.imul(E, W)) | 0),
							(e = (e + Math.imul(M, Y)) | 0),
							(n = ((n = (n + Math.imul(M, $)) | 0) + Math.imul(b, Y)) | 0),
							(o = (o + Math.imul(b, $)) | 0),
							(e = (e + Math.imul(v, J)) | 0),
							(n = ((n = (n + Math.imul(v, K)) | 0) + Math.imul(y, J)) | 0),
							(o = (o + Math.imul(y, K)) | 0),
							(e = (e + Math.imul(d, Q)) | 0),
							(n = ((n = (n + Math.imul(d, tt)) | 0) + Math.imul(p, Q)) | 0),
							(o = (o + Math.imul(p, tt)) | 0);
						var bt =
							(((a + (e = (e + Math.imul(f, it)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, et)) | 0) + Math.imul(m, it)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, et)) | 0) + (n >>> 13)) | 0) + (bt >>> 26)) | 0),
							(bt &= 67108863),
							(e = Math.imul(R, Z)),
							(n = ((n = Math.imul(R, z)) + Math.imul(k, Z)) | 0),
							(o = Math.imul(k, z)),
							(e = (e + Math.imul(S, H)) | 0),
							(n = ((n = (n + Math.imul(S, W)) | 0) + Math.imul(N, H)) | 0),
							(o = (o + Math.imul(N, W)) | 0),
							(e = (e + Math.imul(A, Y)) | 0),
							(n = ((n = (n + Math.imul(A, $)) | 0) + Math.imul(E, Y)) | 0),
							(o = (o + Math.imul(E, $)) | 0),
							(e = (e + Math.imul(M, J)) | 0),
							(n = ((n = (n + Math.imul(M, K)) | 0) + Math.imul(b, J)) | 0),
							(o = (o + Math.imul(b, K)) | 0),
							(e = (e + Math.imul(v, Q)) | 0),
							(n = ((n = (n + Math.imul(v, tt)) | 0) + Math.imul(y, Q)) | 0),
							(o = (o + Math.imul(y, tt)) | 0),
							(e = (e + Math.imul(d, it)) | 0),
							(n = ((n = (n + Math.imul(d, et)) | 0) + Math.imul(p, it)) | 0),
							(o = (o + Math.imul(p, et)) | 0);
						var _t =
							(((a + (e = (e + Math.imul(f, ot)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, st)) | 0) + Math.imul(m, ot)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, st)) | 0) + (n >>> 13)) | 0) + (_t >>> 26)) | 0),
							(_t &= 67108863),
							(e = Math.imul(B, Z)),
							(n = ((n = Math.imul(B, z)) + Math.imul(O, Z)) | 0),
							(o = Math.imul(O, z)),
							(e = (e + Math.imul(R, H)) | 0),
							(n = ((n = (n + Math.imul(R, W)) | 0) + Math.imul(k, H)) | 0),
							(o = (o + Math.imul(k, W)) | 0),
							(e = (e + Math.imul(S, Y)) | 0),
							(n = ((n = (n + Math.imul(S, $)) | 0) + Math.imul(N, Y)) | 0),
							(o = (o + Math.imul(N, $)) | 0),
							(e = (e + Math.imul(A, J)) | 0),
							(n = ((n = (n + Math.imul(A, K)) | 0) + Math.imul(E, J)) | 0),
							(o = (o + Math.imul(E, K)) | 0),
							(e = (e + Math.imul(M, Q)) | 0),
							(n = ((n = (n + Math.imul(M, tt)) | 0) + Math.imul(b, Q)) | 0),
							(o = (o + Math.imul(b, tt)) | 0),
							(e = (e + Math.imul(v, it)) | 0),
							(n = ((n = (n + Math.imul(v, et)) | 0) + Math.imul(y, it)) | 0),
							(o = (o + Math.imul(y, et)) | 0),
							(e = (e + Math.imul(d, ot)) | 0),
							(n = ((n = (n + Math.imul(d, st)) | 0) + Math.imul(p, ot)) | 0),
							(o = (o + Math.imul(p, st)) | 0);
						var At =
							(((a + (e = (e + Math.imul(f, ut)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, at)) | 0) + Math.imul(m, ut)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, at)) | 0) + (n >>> 13)) | 0) + (At >>> 26)) | 0),
							(At &= 67108863),
							(e = Math.imul(L, Z)),
							(n = ((n = Math.imul(L, z)) + Math.imul(j, Z)) | 0),
							(o = Math.imul(j, z)),
							(e = (e + Math.imul(B, H)) | 0),
							(n = ((n = (n + Math.imul(B, W)) | 0) + Math.imul(O, H)) | 0),
							(o = (o + Math.imul(O, W)) | 0),
							(e = (e + Math.imul(R, Y)) | 0),
							(n = ((n = (n + Math.imul(R, $)) | 0) + Math.imul(k, Y)) | 0),
							(o = (o + Math.imul(k, $)) | 0),
							(e = (e + Math.imul(S, J)) | 0),
							(n = ((n = (n + Math.imul(S, K)) | 0) + Math.imul(N, J)) | 0),
							(o = (o + Math.imul(N, K)) | 0),
							(e = (e + Math.imul(A, Q)) | 0),
							(n = ((n = (n + Math.imul(A, tt)) | 0) + Math.imul(E, Q)) | 0),
							(o = (o + Math.imul(E, tt)) | 0),
							(e = (e + Math.imul(M, it)) | 0),
							(n = ((n = (n + Math.imul(M, et)) | 0) + Math.imul(b, it)) | 0),
							(o = (o + Math.imul(b, et)) | 0),
							(e = (e + Math.imul(v, ot)) | 0),
							(n = ((n = (n + Math.imul(v, st)) | 0) + Math.imul(y, ot)) | 0),
							(o = (o + Math.imul(y, st)) | 0),
							(e = (e + Math.imul(d, ut)) | 0),
							(n = ((n = (n + Math.imul(d, at)) | 0) + Math.imul(p, ut)) | 0),
							(o = (o + Math.imul(p, at)) | 0);
						var Et =
							(((a + (e = (e + Math.imul(f, ft)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, mt)) | 0) + Math.imul(m, ft)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, mt)) | 0) + (n >>> 13)) | 0) + (Et >>> 26)) | 0),
							(Et &= 67108863),
							(e = Math.imul(U, Z)),
							(n = ((n = Math.imul(U, z)) + Math.imul(F, Z)) | 0),
							(o = Math.imul(F, z)),
							(e = (e + Math.imul(L, H)) | 0),
							(n = ((n = (n + Math.imul(L, W)) | 0) + Math.imul(j, H)) | 0),
							(o = (o + Math.imul(j, W)) | 0),
							(e = (e + Math.imul(B, Y)) | 0),
							(n = ((n = (n + Math.imul(B, $)) | 0) + Math.imul(O, Y)) | 0),
							(o = (o + Math.imul(O, $)) | 0),
							(e = (e + Math.imul(R, J)) | 0),
							(n = ((n = (n + Math.imul(R, K)) | 0) + Math.imul(k, J)) | 0),
							(o = (o + Math.imul(k, K)) | 0),
							(e = (e + Math.imul(S, Q)) | 0),
							(n = ((n = (n + Math.imul(S, tt)) | 0) + Math.imul(N, Q)) | 0),
							(o = (o + Math.imul(N, tt)) | 0),
							(e = (e + Math.imul(A, it)) | 0),
							(n = ((n = (n + Math.imul(A, et)) | 0) + Math.imul(E, it)) | 0),
							(o = (o + Math.imul(E, et)) | 0),
							(e = (e + Math.imul(M, ot)) | 0),
							(n = ((n = (n + Math.imul(M, st)) | 0) + Math.imul(b, ot)) | 0),
							(o = (o + Math.imul(b, st)) | 0),
							(e = (e + Math.imul(v, ut)) | 0),
							(n = ((n = (n + Math.imul(v, at)) | 0) + Math.imul(y, ut)) | 0),
							(o = (o + Math.imul(y, at)) | 0),
							(e = (e + Math.imul(d, ft)) | 0),
							(n = ((n = (n + Math.imul(d, mt)) | 0) + Math.imul(p, ft)) | 0),
							(o = (o + Math.imul(p, mt)) | 0);
						var xt =
							(((a + (e = (e + Math.imul(f, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(f, pt)) | 0) + Math.imul(m, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(m, pt)) | 0) + (n >>> 13)) | 0) + (xt >>> 26)) | 0),
							(xt &= 67108863),
							(e = Math.imul(U, H)),
							(n = ((n = Math.imul(U, W)) + Math.imul(F, H)) | 0),
							(o = Math.imul(F, W)),
							(e = (e + Math.imul(L, Y)) | 0),
							(n = ((n = (n + Math.imul(L, $)) | 0) + Math.imul(j, Y)) | 0),
							(o = (o + Math.imul(j, $)) | 0),
							(e = (e + Math.imul(B, J)) | 0),
							(n = ((n = (n + Math.imul(B, K)) | 0) + Math.imul(O, J)) | 0),
							(o = (o + Math.imul(O, K)) | 0),
							(e = (e + Math.imul(R, Q)) | 0),
							(n = ((n = (n + Math.imul(R, tt)) | 0) + Math.imul(k, Q)) | 0),
							(o = (o + Math.imul(k, tt)) | 0),
							(e = (e + Math.imul(S, it)) | 0),
							(n = ((n = (n + Math.imul(S, et)) | 0) + Math.imul(N, it)) | 0),
							(o = (o + Math.imul(N, et)) | 0),
							(e = (e + Math.imul(A, ot)) | 0),
							(n = ((n = (n + Math.imul(A, st)) | 0) + Math.imul(E, ot)) | 0),
							(o = (o + Math.imul(E, st)) | 0),
							(e = (e + Math.imul(M, ut)) | 0),
							(n = ((n = (n + Math.imul(M, at)) | 0) + Math.imul(b, ut)) | 0),
							(o = (o + Math.imul(b, at)) | 0),
							(e = (e + Math.imul(v, ft)) | 0),
							(n = ((n = (n + Math.imul(v, mt)) | 0) + Math.imul(y, ft)) | 0),
							(o = (o + Math.imul(y, mt)) | 0);
						var St =
							(((a + (e = (e + Math.imul(d, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(d, pt)) | 0) + Math.imul(p, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(p, pt)) | 0) + (n >>> 13)) | 0) + (St >>> 26)) | 0),
							(St &= 67108863),
							(e = Math.imul(U, Y)),
							(n = ((n = Math.imul(U, $)) + Math.imul(F, Y)) | 0),
							(o = Math.imul(F, $)),
							(e = (e + Math.imul(L, J)) | 0),
							(n = ((n = (n + Math.imul(L, K)) | 0) + Math.imul(j, J)) | 0),
							(o = (o + Math.imul(j, K)) | 0),
							(e = (e + Math.imul(B, Q)) | 0),
							(n = ((n = (n + Math.imul(B, tt)) | 0) + Math.imul(O, Q)) | 0),
							(o = (o + Math.imul(O, tt)) | 0),
							(e = (e + Math.imul(R, it)) | 0),
							(n = ((n = (n + Math.imul(R, et)) | 0) + Math.imul(k, it)) | 0),
							(o = (o + Math.imul(k, et)) | 0),
							(e = (e + Math.imul(S, ot)) | 0),
							(n = ((n = (n + Math.imul(S, st)) | 0) + Math.imul(N, ot)) | 0),
							(o = (o + Math.imul(N, st)) | 0),
							(e = (e + Math.imul(A, ut)) | 0),
							(n = ((n = (n + Math.imul(A, at)) | 0) + Math.imul(E, ut)) | 0),
							(o = (o + Math.imul(E, at)) | 0),
							(e = (e + Math.imul(M, ft)) | 0),
							(n = ((n = (n + Math.imul(M, mt)) | 0) + Math.imul(b, ft)) | 0),
							(o = (o + Math.imul(b, mt)) | 0);
						var Nt =
							(((a + (e = (e + Math.imul(v, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(v, pt)) | 0) + Math.imul(y, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(y, pt)) | 0) + (n >>> 13)) | 0) + (Nt >>> 26)) | 0),
							(Nt &= 67108863),
							(e = Math.imul(U, J)),
							(n = ((n = Math.imul(U, K)) + Math.imul(F, J)) | 0),
							(o = Math.imul(F, K)),
							(e = (e + Math.imul(L, Q)) | 0),
							(n = ((n = (n + Math.imul(L, tt)) | 0) + Math.imul(j, Q)) | 0),
							(o = (o + Math.imul(j, tt)) | 0),
							(e = (e + Math.imul(B, it)) | 0),
							(n = ((n = (n + Math.imul(B, et)) | 0) + Math.imul(O, it)) | 0),
							(o = (o + Math.imul(O, et)) | 0),
							(e = (e + Math.imul(R, ot)) | 0),
							(n = ((n = (n + Math.imul(R, st)) | 0) + Math.imul(k, ot)) | 0),
							(o = (o + Math.imul(k, st)) | 0),
							(e = (e + Math.imul(S, ut)) | 0),
							(n = ((n = (n + Math.imul(S, at)) | 0) + Math.imul(N, ut)) | 0),
							(o = (o + Math.imul(N, at)) | 0),
							(e = (e + Math.imul(A, ft)) | 0),
							(n = ((n = (n + Math.imul(A, mt)) | 0) + Math.imul(E, ft)) | 0),
							(o = (o + Math.imul(E, mt)) | 0);
						var Tt =
							(((a + (e = (e + Math.imul(M, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(M, pt)) | 0) + Math.imul(b, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(b, pt)) | 0) + (n >>> 13)) | 0) + (Tt >>> 26)) | 0),
							(Tt &= 67108863),
							(e = Math.imul(U, Q)),
							(n = ((n = Math.imul(U, tt)) + Math.imul(F, Q)) | 0),
							(o = Math.imul(F, tt)),
							(e = (e + Math.imul(L, it)) | 0),
							(n = ((n = (n + Math.imul(L, et)) | 0) + Math.imul(j, it)) | 0),
							(o = (o + Math.imul(j, et)) | 0),
							(e = (e + Math.imul(B, ot)) | 0),
							(n = ((n = (n + Math.imul(B, st)) | 0) + Math.imul(O, ot)) | 0),
							(o = (o + Math.imul(O, st)) | 0),
							(e = (e + Math.imul(R, ut)) | 0),
							(n = ((n = (n + Math.imul(R, at)) | 0) + Math.imul(k, ut)) | 0),
							(o = (o + Math.imul(k, at)) | 0),
							(e = (e + Math.imul(S, ft)) | 0),
							(n = ((n = (n + Math.imul(S, mt)) | 0) + Math.imul(N, ft)) | 0),
							(o = (o + Math.imul(N, mt)) | 0);
						var Rt =
							(((a + (e = (e + Math.imul(A, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(A, pt)) | 0) + Math.imul(E, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(E, pt)) | 0) + (n >>> 13)) | 0) + (Rt >>> 26)) | 0),
							(Rt &= 67108863),
							(e = Math.imul(U, it)),
							(n = ((n = Math.imul(U, et)) + Math.imul(F, it)) | 0),
							(o = Math.imul(F, et)),
							(e = (e + Math.imul(L, ot)) | 0),
							(n = ((n = (n + Math.imul(L, st)) | 0) + Math.imul(j, ot)) | 0),
							(o = (o + Math.imul(j, st)) | 0),
							(e = (e + Math.imul(B, ut)) | 0),
							(n = ((n = (n + Math.imul(B, at)) | 0) + Math.imul(O, ut)) | 0),
							(o = (o + Math.imul(O, at)) | 0),
							(e = (e + Math.imul(R, ft)) | 0),
							(n = ((n = (n + Math.imul(R, mt)) | 0) + Math.imul(k, ft)) | 0),
							(o = (o + Math.imul(k, mt)) | 0);
						var kt =
							(((a + (e = (e + Math.imul(S, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(S, pt)) | 0) + Math.imul(N, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(N, pt)) | 0) + (n >>> 13)) | 0) + (kt >>> 26)) | 0),
							(kt &= 67108863),
							(e = Math.imul(U, ot)),
							(n = ((n = Math.imul(U, st)) + Math.imul(F, ot)) | 0),
							(o = Math.imul(F, st)),
							(e = (e + Math.imul(L, ut)) | 0),
							(n = ((n = (n + Math.imul(L, at)) | 0) + Math.imul(j, ut)) | 0),
							(o = (o + Math.imul(j, at)) | 0),
							(e = (e + Math.imul(B, ft)) | 0),
							(n = ((n = (n + Math.imul(B, mt)) | 0) + Math.imul(O, ft)) | 0),
							(o = (o + Math.imul(O, mt)) | 0);
						var It =
							(((a + (e = (e + Math.imul(R, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(R, pt)) | 0) + Math.imul(k, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(k, pt)) | 0) + (n >>> 13)) | 0) + (It >>> 26)) | 0),
							(It &= 67108863),
							(e = Math.imul(U, ut)),
							(n = ((n = Math.imul(U, at)) + Math.imul(F, ut)) | 0),
							(o = Math.imul(F, at)),
							(e = (e + Math.imul(L, ft)) | 0),
							(n = ((n = (n + Math.imul(L, mt)) | 0) + Math.imul(j, ft)) | 0),
							(o = (o + Math.imul(j, mt)) | 0);
						var Bt =
							(((a + (e = (e + Math.imul(B, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(B, pt)) | 0) + Math.imul(O, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(O, pt)) | 0) + (n >>> 13)) | 0) + (Bt >>> 26)) | 0),
							(Bt &= 67108863),
							(e = Math.imul(U, ft)),
							(n = ((n = Math.imul(U, mt)) + Math.imul(F, ft)) | 0),
							(o = Math.imul(F, mt));
						var Ot =
							(((a + (e = (e + Math.imul(L, dt)) | 0)) | 0) +
								((8191 & (n = ((n = (n + Math.imul(L, pt)) | 0) + Math.imul(j, dt)) | 0)) << 13)) |
							0;
						(a = ((((o = (o + Math.imul(j, pt)) | 0) + (n >>> 13)) | 0) + (Ot >>> 26)) | 0),
							(Ot &= 67108863);
						var Ct =
							(((a + (e = Math.imul(U, dt))) | 0) +
								((8191 & (n = ((n = Math.imul(U, pt)) + Math.imul(F, dt)) | 0)) << 13)) |
							0;
						return (
							(a = ((((o = Math.imul(F, pt)) + (n >>> 13)) | 0) + (Ct >>> 26)) | 0),
							(Ct &= 67108863),
							(u[0] = gt),
							(u[1] = vt),
							(u[2] = yt),
							(u[3] = wt),
							(u[4] = Mt),
							(u[5] = bt),
							(u[6] = _t),
							(u[7] = At),
							(u[8] = Et),
							(u[9] = xt),
							(u[10] = St),
							(u[11] = Nt),
							(u[12] = Tt),
							(u[13] = Rt),
							(u[14] = kt),
							(u[15] = It),
							(u[16] = Bt),
							(u[17] = Ot),
							(u[18] = Ct),
							0 !== a && ((u[19] = a), i.length++),
							i
						);
					};
					function d(t, r, i) {
						return new p().mulp(t, r, i);
					}
					function p(t, r) {
						(this.x = t), (this.y = r);
					}
					Math.imul || (c = m),
						(o.prototype.mulTo = function (t, r) {
							var i = this.length + t.length;
							return 10 === this.length && 10 === t.length
								? c(this, t, r)
								: i < 63
								? m(this, t, r)
								: i < 1024
								? (function (t, r, i) {
										(i.negative = r.negative ^ t.negative), (i.length = t.length + r.length);
										for (var e = 0, n = 0, o = 0; o < i.length - 1; o++) {
											var s = n;
											n = 0;
											for (
												var h = 67108863 & e,
													u = Math.min(o, r.length - 1),
													a = Math.max(0, o - t.length + 1);
												a <= u;
												a++
											) {
												var l = o - a,
													f = (0 | t.words[l]) * (0 | r.words[a]),
													m = 67108863 & f;
												(h = 67108863 & (m = (m + h) | 0)),
													(n +=
														(s = ((s = (s + ((f / 67108864) | 0)) | 0) + (m >>> 26)) | 0) >>> 26),
													(s &= 67108863);
											}
											(i.words[o] = h), (e = s), (s = n);
										}
										return 0 !== e ? (i.words[o] = e) : i.length--, i.strip();
								  })(this, t, r)
								: d(this, t, r);
						}),
						(p.prototype.makeRBT = function (t) {
							for (var r = new Array(t), i = o.prototype._countBits(t) - 1, e = 0; e < t; e++)
								r[e] = this.revBin(e, i, t);
							return r;
						}),
						(p.prototype.revBin = function (t, r, i) {
							if (0 === t || t === i - 1) return t;
							for (var e = 0, n = 0; n < r; n++) (e |= (1 & t) << (r - n - 1)), (t >>= 1);
							return e;
						}),
						(p.prototype.permute = function (t, r, i, e, n, o) {
							for (var s = 0; s < o; s++) (e[s] = r[t[s]]), (n[s] = i[t[s]]);
						}),
						(p.prototype.transform = function (t, r, i, e, n, o) {
							this.permute(o, t, r, i, e, n);
							for (var s = 1; s < n; s <<= 1)
								for (
									var h = s << 1,
										u = Math.cos((2 * Math.PI) / h),
										a = Math.sin((2 * Math.PI) / h),
										l = 0;
									l < n;
									l += h
								)
									for (var f = u, m = a, c = 0; c < s; c++) {
										var d = i[l + c],
											p = e[l + c],
											g = i[l + c + s],
											v = e[l + c + s],
											y = f * g - m * v;
										(v = f * v + m * g),
											(g = y),
											(i[l + c] = d + g),
											(e[l + c] = p + v),
											(i[l + c + s] = d - g),
											(e[l + c + s] = p - v),
											c !== h && ((y = u * f - a * m), (m = u * m + a * f), (f = y));
									}
						}),
						(p.prototype.guessLen13b = function (t, r) {
							var i = 1 | Math.max(r, t),
								e = 1 & i,
								n = 0;
							for (i = (i / 2) | 0; i; i >>>= 1) n++;
							return 1 << (n + 1 + e);
						}),
						(p.prototype.conjugate = function (t, r, i) {
							if (!(i <= 1))
								for (var e = 0; e < i / 2; e++) {
									var n = t[e];
									(t[e] = t[i - e - 1]),
										(t[i - e - 1] = n),
										(n = r[e]),
										(r[e] = -r[i - e - 1]),
										(r[i - e - 1] = -n);
								}
						}),
						(p.prototype.normalize13b = function (t, r) {
							for (var i = 0, e = 0; e < r / 2; e++) {
								var n = 8192 * Math.round(t[2 * e + 1] / r) + Math.round(t[2 * e] / r) + i;
								(t[e] = 67108863 & n), (i = n < 67108864 ? 0 : (n / 67108864) | 0);
							}
							return t;
						}),
						(p.prototype.convert13b = function (t, r, i, n) {
							for (var o = 0, s = 0; s < r; s++)
								(o += 0 | t[s]),
									(i[2 * s] = 8191 & o),
									(o >>>= 13),
									(i[2 * s + 1] = 8191 & o),
									(o >>>= 13);
							for (s = 2 * r; s < n; ++s) i[s] = 0;
							e(0 === o), e(0 == (-8192 & o));
						}),
						(p.prototype.stub = function (t) {
							for (var r = new Array(t), i = 0; i < t; i++) r[i] = 0;
							return r;
						}),
						(p.prototype.mulp = function (t, r, i) {
							var e = 2 * this.guessLen13b(t.length, r.length),
								n = this.makeRBT(e),
								o = this.stub(e),
								s = new Array(e),
								h = new Array(e),
								u = new Array(e),
								a = new Array(e),
								l = new Array(e),
								f = new Array(e),
								m = i.words;
							(m.length = e),
								this.convert13b(t.words, t.length, s, e),
								this.convert13b(r.words, r.length, a, e),
								this.transform(s, o, h, u, e, n),
								this.transform(a, o, l, f, e, n);
							for (var c = 0; c < e; c++) {
								var d = h[c] * l[c] - u[c] * f[c];
								(u[c] = h[c] * f[c] + u[c] * l[c]), (h[c] = d);
							}
							return (
								this.conjugate(h, u, e),
								this.transform(h, u, m, o, e, n),
								this.conjugate(m, o, e),
								this.normalize13b(m, e),
								(i.negative = t.negative ^ r.negative),
								(i.length = t.length + r.length),
								i.strip()
							);
						}),
						(o.prototype.mul = function (t) {
							var r = new o(null);
							return (r.words = new Array(this.length + t.length)), this.mulTo(t, r);
						}),
						(o.prototype.mulf = function (t) {
							var r = new o(null);
							return (r.words = new Array(this.length + t.length)), d(this, t, r);
						}),
						(o.prototype.imul = function (t) {
							return this.clone().mulTo(t, this);
						}),
						(o.prototype.imuln = function (t) {
							e('number' == typeof t), e(t < 67108864);
							for (var r = 0, i = 0; i < this.length; i++) {
								var n = (0 | this.words[i]) * t,
									o = (67108863 & n) + (67108863 & r);
								(r >>= 26),
									(r += (n / 67108864) | 0),
									(r += o >>> 26),
									(this.words[i] = 67108863 & o);
							}
							return 0 !== r && ((this.words[i] = r), this.length++), this;
						}),
						(o.prototype.muln = function (t) {
							return this.clone().imuln(t);
						}),
						(o.prototype.sqr = function () {
							return this.mul(this);
						}),
						(o.prototype.isqr = function () {
							return this.imul(this.clone());
						}),
						(o.prototype.pow = function (t) {
							var r = (function (t) {
								for (var r = new Array(t.bitLength()), i = 0; i < r.length; i++) {
									var e = (i / 26) | 0,
										n = i % 26;
									r[i] = (t.words[e] & (1 << n)) >>> n;
								}
								return r;
							})(t);
							if (0 === r.length) return new o(1);
							for (var i = this, e = 0; e < r.length && 0 === r[e]; e++, i = i.sqr());
							if (++e < r.length)
								for (var n = i.sqr(); e < r.length; e++, n = n.sqr()) 0 !== r[e] && (i = i.mul(n));
							return i;
						}),
						(o.prototype.iushln = function (t) {
							e('number' == typeof t && t >= 0);
							var r,
								i = t % 26,
								n = (t - i) / 26,
								o = (67108863 >>> (26 - i)) << (26 - i);
							if (0 !== i) {
								var s = 0;
								for (r = 0; r < this.length; r++) {
									var h = this.words[r] & o,
										u = ((0 | this.words[r]) - h) << i;
									(this.words[r] = u | s), (s = h >>> (26 - i));
								}
								s && ((this.words[r] = s), this.length++);
							}
							if (0 !== n) {
								for (r = this.length - 1; r >= 0; r--) this.words[r + n] = this.words[r];
								for (r = 0; r < n; r++) this.words[r] = 0;
								this.length += n;
							}
							return this.strip();
						}),
						(o.prototype.ishln = function (t) {
							return e(0 === this.negative), this.iushln(t);
						}),
						(o.prototype.iushrn = function (t, r, i) {
							var n;
							e('number' == typeof t && t >= 0), (n = r ? (r - (r % 26)) / 26 : 0);
							var o = t % 26,
								s = Math.min((t - o) / 26, this.length),
								h = 67108863 ^ ((67108863 >>> o) << o),
								u = i;
							if (((n -= s), (n = Math.max(0, n)), u)) {
								for (var a = 0; a < s; a++) u.words[a] = this.words[a];
								u.length = s;
							}
							if (0 === s);
							else if (this.length > s)
								for (this.length -= s, a = 0; a < this.length; a++)
									this.words[a] = this.words[a + s];
							else (this.words[0] = 0), (this.length = 1);
							var l = 0;
							for (a = this.length - 1; a >= 0 && (0 !== l || a >= n); a--) {
								var f = 0 | this.words[a];
								(this.words[a] = (l << (26 - o)) | (f >>> o)), (l = f & h);
							}
							return (
								u && 0 !== l && (u.words[u.length++] = l),
								0 === this.length && ((this.words[0] = 0), (this.length = 1)),
								this.strip()
							);
						}),
						(o.prototype.ishrn = function (t, r, i) {
							return e(0 === this.negative), this.iushrn(t, r, i);
						}),
						(o.prototype.shln = function (t) {
							return this.clone().ishln(t);
						}),
						(o.prototype.ushln = function (t) {
							return this.clone().iushln(t);
						}),
						(o.prototype.shrn = function (t) {
							return this.clone().ishrn(t);
						}),
						(o.prototype.ushrn = function (t) {
							return this.clone().iushrn(t);
						}),
						(o.prototype.testn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = t % 26,
								i = (t - r) / 26,
								n = 1 << r;
							return !(this.length <= i) && !!(this.words[i] & n);
						}),
						(o.prototype.imaskn = function (t) {
							e('number' == typeof t && t >= 0);
							var r = t % 26,
								i = (t - r) / 26;
							if (
								(e(0 === this.negative, 'imaskn works only with positive numbers'),
								this.length <= i)
							)
								return this;
							if ((0 !== r && i++, (this.length = Math.min(i, this.length)), 0 !== r)) {
								var n = 67108863 ^ ((67108863 >>> r) << r);
								this.words[this.length - 1] &= n;
							}
							return this.strip();
						}),
						(o.prototype.maskn = function (t) {
							return this.clone().imaskn(t);
						}),
						(o.prototype.iaddn = function (t) {
							return (
								e('number' == typeof t),
								e(t < 67108864),
								t < 0
									? this.isubn(-t)
									: 0 !== this.negative
									? 1 === this.length && (0 | this.words[0]) < t
										? ((this.words[0] = t - (0 | this.words[0])), (this.negative = 0), this)
										: ((this.negative = 0), this.isubn(t), (this.negative = 1), this)
									: this._iaddn(t)
							);
						}),
						(o.prototype._iaddn = function (t) {
							this.words[0] += t;
							for (var r = 0; r < this.length && this.words[r] >= 67108864; r++)
								(this.words[r] -= 67108864),
									r === this.length - 1 ? (this.words[r + 1] = 1) : this.words[r + 1]++;
							return (this.length = Math.max(this.length, r + 1)), this;
						}),
						(o.prototype.isubn = function (t) {
							if ((e('number' == typeof t), e(t < 67108864), t < 0)) return this.iaddn(-t);
							if (0 !== this.negative)
								return (this.negative = 0), this.iaddn(t), (this.negative = 1), this;
							if (((this.words[0] -= t), 1 === this.length && this.words[0] < 0))
								(this.words[0] = -this.words[0]), (this.negative = 1);
							else
								for (var r = 0; r < this.length && this.words[r] < 0; r++)
									(this.words[r] += 67108864), (this.words[r + 1] -= 1);
							return this.strip();
						}),
						(o.prototype.addn = function (t) {
							return this.clone().iaddn(t);
						}),
						(o.prototype.subn = function (t) {
							return this.clone().isubn(t);
						}),
						(o.prototype.iabs = function () {
							return (this.negative = 0), this;
						}),
						(o.prototype.abs = function () {
							return this.clone().iabs();
						}),
						(o.prototype._ishlnsubmul = function (t, r, i) {
							var n,
								o,
								s = t.length + i;
							this._expand(s);
							var h = 0;
							for (n = 0; n < t.length; n++) {
								o = (0 | this.words[n + i]) + h;
								var u = (0 | t.words[n]) * r;
								(h = ((o -= 67108863 & u) >> 26) - ((u / 67108864) | 0)),
									(this.words[n + i] = 67108863 & o);
							}
							for (; n < this.length - i; n++)
								(h = (o = (0 | this.words[n + i]) + h) >> 26), (this.words[n + i] = 67108863 & o);
							if (0 === h) return this.strip();
							for (e(-1 === h), h = 0, n = 0; n < this.length; n++)
								(h = (o = -(0 | this.words[n]) + h) >> 26), (this.words[n] = 67108863 & o);
							return (this.negative = 1), this.strip();
						}),
						(o.prototype._wordDiv = function (t, r) {
							var i = (this.length, t.length),
								e = this.clone(),
								n = t,
								s = 0 | n.words[n.length - 1];
							0 !== (i = 26 - this._countBits(s)) &&
								((n = n.ushln(i)), e.iushln(i), (s = 0 | n.words[n.length - 1]));
							var h,
								u = e.length - n.length;
							if ('mod' !== r) {
								((h = new o(null)).length = u + 1), (h.words = new Array(h.length));
								for (var a = 0; a < h.length; a++) h.words[a] = 0;
							}
							var l = e.clone()._ishlnsubmul(n, 1, u);
							0 === l.negative && ((e = l), h && (h.words[u] = 1));
							for (var f = u - 1; f >= 0; f--) {
								var m = 67108864 * (0 | e.words[n.length + f]) + (0 | e.words[n.length + f - 1]);
								for (
									m = Math.min((m / s) | 0, 67108863), e._ishlnsubmul(n, m, f);
									0 !== e.negative;

								)
									m--, (e.negative = 0), e._ishlnsubmul(n, 1, f), e.isZero() || (e.negative ^= 1);
								h && (h.words[f] = m);
							}
							return (
								h && h.strip(),
								e.strip(),
								'div' !== r && 0 !== i && e.iushrn(i),
								{ div: h || null, mod: e }
							);
						}),
						(o.prototype.divmod = function (t, r, i) {
							return (
								e(!t.isZero()),
								this.isZero()
									? { div: new o(0), mod: new o(0) }
									: 0 !== this.negative && 0 === t.negative
									? ((h = this.neg().divmod(t, r)),
									  'mod' !== r && (n = h.div.neg()),
									  'div' !== r && ((s = h.mod.neg()), i && 0 !== s.negative && s.iadd(t)),
									  { div: n, mod: s })
									: 0 === this.negative && 0 !== t.negative
									? ((h = this.divmod(t.neg(), r)),
									  'mod' !== r && (n = h.div.neg()),
									  { div: n, mod: h.mod })
									: 0 != (this.negative & t.negative)
									? ((h = this.neg().divmod(t.neg(), r)),
									  'div' !== r && ((s = h.mod.neg()), i && 0 !== s.negative && s.isub(t)),
									  { div: h.div, mod: s })
									: t.length > this.length || this.cmp(t) < 0
									? { div: new o(0), mod: this }
									: 1 === t.length
									? 'div' === r
										? { div: this.divn(t.words[0]), mod: null }
										: 'mod' === r
										? { div: null, mod: new o(this.modn(t.words[0])) }
										: { div: this.divn(t.words[0]), mod: new o(this.modn(t.words[0])) }
									: this._wordDiv(t, r)
							);
							var n, s, h;
						}),
						(o.prototype.div = function (t) {
							return this.divmod(t, 'div', !1).div;
						}),
						(o.prototype.mod = function (t) {
							return this.divmod(t, 'mod', !1).mod;
						}),
						(o.prototype.umod = function (t) {
							return this.divmod(t, 'mod', !0).mod;
						}),
						(o.prototype.divRound = function (t) {
							var r = this.divmod(t);
							if (r.mod.isZero()) return r.div;
							var i = 0 !== r.div.negative ? r.mod.isub(t) : r.mod,
								e = t.ushrn(1),
								n = t.andln(1),
								o = i.cmp(e);
							return o < 0 || (1 === n && 0 === o)
								? r.div
								: 0 !== r.div.negative
								? r.div.isubn(1)
								: r.div.iaddn(1);
						}),
						(o.prototype.modn = function (t) {
							e(t <= 67108863);
							for (var r = (1 << 26) % t, i = 0, n = this.length - 1; n >= 0; n--)
								i = (r * i + (0 | this.words[n])) % t;
							return i;
						}),
						(o.prototype.idivn = function (t) {
							e(t <= 67108863);
							for (var r = 0, i = this.length - 1; i >= 0; i--) {
								var n = (0 | this.words[i]) + 67108864 * r;
								(this.words[i] = (n / t) | 0), (r = n % t);
							}
							return this.strip();
						}),
						(o.prototype.divn = function (t) {
							return this.clone().idivn(t);
						}),
						(o.prototype.egcd = function (t) {
							e(0 === t.negative), e(!t.isZero());
							var r = this,
								i = t.clone();
							r = 0 !== r.negative ? r.umod(t) : r.clone();
							for (
								var n = new o(1), s = new o(0), h = new o(0), u = new o(1), a = 0;
								r.isEven() && i.isEven();

							)
								r.iushrn(1), i.iushrn(1), ++a;
							for (var l = i.clone(), f = r.clone(); !r.isZero(); ) {
								for (var m = 0, c = 1; 0 == (r.words[0] & c) && m < 26; ++m, c <<= 1);
								if (m > 0)
									for (r.iushrn(m); m-- > 0; )
										(n.isOdd() || s.isOdd()) && (n.iadd(l), s.isub(f)), n.iushrn(1), s.iushrn(1);
								for (var d = 0, p = 1; 0 == (i.words[0] & p) && d < 26; ++d, p <<= 1);
								if (d > 0)
									for (i.iushrn(d); d-- > 0; )
										(h.isOdd() || u.isOdd()) && (h.iadd(l), u.isub(f)), h.iushrn(1), u.iushrn(1);
								r.cmp(i) >= 0
									? (r.isub(i), n.isub(h), s.isub(u))
									: (i.isub(r), h.isub(n), u.isub(s));
							}
							return { a: h, b: u, gcd: i.iushln(a) };
						}),
						(o.prototype._invmp = function (t) {
							e(0 === t.negative), e(!t.isZero());
							var r = this,
								i = t.clone();
							r = 0 !== r.negative ? r.umod(t) : r.clone();
							for (
								var n, s = new o(1), h = new o(0), u = i.clone();
								r.cmpn(1) > 0 && i.cmpn(1) > 0;

							) {
								for (var a = 0, l = 1; 0 == (r.words[0] & l) && a < 26; ++a, l <<= 1);
								if (a > 0) for (r.iushrn(a); a-- > 0; ) s.isOdd() && s.iadd(u), s.iushrn(1);
								for (var f = 0, m = 1; 0 == (i.words[0] & m) && f < 26; ++f, m <<= 1);
								if (f > 0) for (i.iushrn(f); f-- > 0; ) h.isOdd() && h.iadd(u), h.iushrn(1);
								r.cmp(i) >= 0 ? (r.isub(i), s.isub(h)) : (i.isub(r), h.isub(s));
							}
							return (n = 0 === r.cmpn(1) ? s : h).cmpn(0) < 0 && n.iadd(t), n;
						}),
						(o.prototype.gcd = function (t) {
							if (this.isZero()) return t.abs();
							if (t.isZero()) return this.abs();
							var r = this.clone(),
								i = t.clone();
							(r.negative = 0), (i.negative = 0);
							for (var e = 0; r.isEven() && i.isEven(); e++) r.iushrn(1), i.iushrn(1);
							for (;;) {
								for (; r.isEven(); ) r.iushrn(1);
								for (; i.isEven(); ) i.iushrn(1);
								var n = r.cmp(i);
								if (n < 0) {
									var o = r;
									(r = i), (i = o);
								} else if (0 === n || 0 === i.cmpn(1)) break;
								r.isub(i);
							}
							return i.iushln(e);
						}),
						(o.prototype.invm = function (t) {
							return this.egcd(t).a.umod(t);
						}),
						(o.prototype.isEven = function () {
							return 0 == (1 & this.words[0]);
						}),
						(o.prototype.isOdd = function () {
							return 1 == (1 & this.words[0]);
						}),
						(o.prototype.andln = function (t) {
							return this.words[0] & t;
						}),
						(o.prototype.bincn = function (t) {
							e('number' == typeof t);
							var r = t % 26,
								i = (t - r) / 26,
								n = 1 << r;
							if (this.length <= i) return this._expand(i + 1), (this.words[i] |= n), this;
							for (var o = n, s = i; 0 !== o && s < this.length; s++) {
								var h = 0 | this.words[s];
								(o = (h += o) >>> 26), (h &= 67108863), (this.words[s] = h);
							}
							return 0 !== o && ((this.words[s] = o), this.length++), this;
						}),
						(o.prototype.isZero = function () {
							return 1 === this.length && 0 === this.words[0];
						}),
						(o.prototype.cmpn = function (t) {
							var r,
								i = t < 0;
							if (0 !== this.negative && !i) return -1;
							if (0 === this.negative && i) return 1;
							if ((this.strip(), this.length > 1)) r = 1;
							else {
								i && (t = -t), e(t <= 67108863, 'Number is too big');
								var n = 0 | this.words[0];
								r = n === t ? 0 : n < t ? -1 : 1;
							}
							return 0 !== this.negative ? 0 | -r : r;
						}),
						(o.prototype.cmp = function (t) {
							if (0 !== this.negative && 0 === t.negative) return -1;
							if (0 === this.negative && 0 !== t.negative) return 1;
							var r = this.ucmp(t);
							return 0 !== this.negative ? 0 | -r : r;
						}),
						(o.prototype.ucmp = function (t) {
							if (this.length > t.length) return 1;
							if (this.length < t.length) return -1;
							for (var r = 0, i = this.length - 1; i >= 0; i--) {
								var e = 0 | this.words[i],
									n = 0 | t.words[i];
								if (e !== n) {
									e < n ? (r = -1) : e > n && (r = 1);
									break;
								}
							}
							return r;
						}),
						(o.prototype.gtn = function (t) {
							return 1 === this.cmpn(t);
						}),
						(o.prototype.gt = function (t) {
							return 1 === this.cmp(t);
						}),
						(o.prototype.gten = function (t) {
							return this.cmpn(t) >= 0;
						}),
						(o.prototype.gte = function (t) {
							return this.cmp(t) >= 0;
						}),
						(o.prototype.ltn = function (t) {
							return -1 === this.cmpn(t);
						}),
						(o.prototype.lt = function (t) {
							return -1 === this.cmp(t);
						}),
						(o.prototype.lten = function (t) {
							return this.cmpn(t) <= 0;
						}),
						(o.prototype.lte = function (t) {
							return this.cmp(t) <= 0;
						}),
						(o.prototype.eqn = function (t) {
							return 0 === this.cmpn(t);
						}),
						(o.prototype.eq = function (t) {
							return 0 === this.cmp(t);
						}),
						(o.red = function (t) {
							return new _(t);
						}),
						(o.prototype.toRed = function (t) {
							return (
								e(!this.red, 'Already a number in reduction context'),
								e(0 === this.negative, 'red works only with positives'),
								t.convertTo(this)._forceRed(t)
							);
						}),
						(o.prototype.fromRed = function () {
							return (
								e(this.red, 'fromRed works only with numbers in reduction context'),
								this.red.convertFrom(this)
							);
						}),
						(o.prototype._forceRed = function (t) {
							return (this.red = t), this;
						}),
						(o.prototype.forceRed = function (t) {
							return e(!this.red, 'Already a number in reduction context'), this._forceRed(t);
						}),
						(o.prototype.redAdd = function (t) {
							return e(this.red, 'redAdd works only with red numbers'), this.red.add(this, t);
						}),
						(o.prototype.redIAdd = function (t) {
							return e(this.red, 'redIAdd works only with red numbers'), this.red.iadd(this, t);
						}),
						(o.prototype.redSub = function (t) {
							return e(this.red, 'redSub works only with red numbers'), this.red.sub(this, t);
						}),
						(o.prototype.redISub = function (t) {
							return e(this.red, 'redISub works only with red numbers'), this.red.isub(this, t);
						}),
						(o.prototype.redShl = function (t) {
							return e(this.red, 'redShl works only with red numbers'), this.red.shl(this, t);
						}),
						(o.prototype.redMul = function (t) {
							return (
								e(this.red, 'redMul works only with red numbers'),
								this.red._verify2(this, t),
								this.red.mul(this, t)
							);
						}),
						(o.prototype.redIMul = function (t) {
							return (
								e(this.red, 'redMul works only with red numbers'),
								this.red._verify2(this, t),
								this.red.imul(this, t)
							);
						}),
						(o.prototype.redSqr = function () {
							return (
								e(this.red, 'redSqr works only with red numbers'),
								this.red._verify1(this),
								this.red.sqr(this)
							);
						}),
						(o.prototype.redISqr = function () {
							return (
								e(this.red, 'redISqr works only with red numbers'),
								this.red._verify1(this),
								this.red.isqr(this)
							);
						}),
						(o.prototype.redSqrt = function () {
							return (
								e(this.red, 'redSqrt works only with red numbers'),
								this.red._verify1(this),
								this.red.sqrt(this)
							);
						}),
						(o.prototype.redInvm = function () {
							return (
								e(this.red, 'redInvm works only with red numbers'),
								this.red._verify1(this),
								this.red.invm(this)
							);
						}),
						(o.prototype.redNeg = function () {
							return (
								e(this.red, 'redNeg works only with red numbers'),
								this.red._verify1(this),
								this.red.neg(this)
							);
						}),
						(o.prototype.redPow = function (t) {
							return (
								e(this.red && !t.red, 'redPow(normalNum)'),
								this.red._verify1(this),
								this.red.pow(this, t)
							);
						});
					var g = { k256: null, p224: null, p192: null, p25519: null };
					function v(t, r) {
						(this.name = t),
							(this.p = new o(r, 16)),
							(this.n = this.p.bitLength()),
							(this.k = new o(1).iushln(this.n).isub(this.p)),
							(this.tmp = this._tmp());
					}
					function y() {
						v.call(
							this,
							'k256',
							'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f'
						);
					}
					function w() {
						v.call(this, 'p224', 'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001');
					}
					function M() {
						v.call(this, 'p192', 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff');
					}
					function b() {
						v.call(
							this,
							'25519',
							'7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed'
						);
					}
					function _(t) {
						if ('string' == typeof t) {
							var r = o._prime(t);
							(this.m = r.p), (this.prime = r);
						} else e(t.gtn(1), 'modulus must be greater than 1'), (this.m = t), (this.prime = null);
					}
					function A(t) {
						_.call(this, t),
							(this.shift = this.m.bitLength()),
							this.shift % 26 != 0 && (this.shift += 26 - (this.shift % 26)),
							(this.r = new o(1).iushln(this.shift)),
							(this.r2 = this.imod(this.r.sqr())),
							(this.rinv = this.r._invmp(this.m)),
							(this.minv = this.rinv.mul(this.r).isubn(1).div(this.m)),
							(this.minv = this.minv.umod(this.r)),
							(this.minv = this.r.sub(this.minv));
					}
					(v.prototype._tmp = function () {
						var t = new o(null);
						return (t.words = new Array(Math.ceil(this.n / 13))), t;
					}),
						(v.prototype.ireduce = function (t) {
							var r,
								i = t;
							do {
								this.split(i, this.tmp), (r = (i = (i = this.imulK(i)).iadd(this.tmp)).bitLength());
							} while (r > this.n);
							var e = r < this.n ? -1 : i.ucmp(this.p);
							return (
								0 === e ? ((i.words[0] = 0), (i.length = 1)) : e > 0 ? i.isub(this.p) : i.strip(), i
							);
						}),
						(v.prototype.split = function (t, r) {
							t.iushrn(this.n, 0, r);
						}),
						(v.prototype.imulK = function (t) {
							return t.imul(this.k);
						}),
						n(y, v),
						(y.prototype.split = function (t, r) {
							for (var i = Math.min(t.length, 9), e = 0; e < i; e++) r.words[e] = t.words[e];
							if (((r.length = i), t.length <= 9)) return (t.words[0] = 0), void (t.length = 1);
							var n = t.words[9];
							for (r.words[r.length++] = 4194303 & n, e = 10; e < t.length; e++) {
								var o = 0 | t.words[e];
								(t.words[e - 10] = ((4194303 & o) << 4) | (n >>> 22)), (n = o);
							}
							(n >>>= 22),
								(t.words[e - 10] = n),
								0 === n && t.length > 10 ? (t.length -= 10) : (t.length -= 9);
						}),
						(y.prototype.imulK = function (t) {
							(t.words[t.length] = 0), (t.words[t.length + 1] = 0), (t.length += 2);
							for (var r = 0, i = 0; i < t.length; i++) {
								var e = 0 | t.words[i];
								(r += 977 * e), (t.words[i] = 67108863 & r), (r = 64 * e + ((r / 67108864) | 0));
							}
							return (
								0 === t.words[t.length - 1] &&
									(t.length--, 0 === t.words[t.length - 1] && t.length--),
								t
							);
						}),
						n(w, v),
						n(M, v),
						n(b, v),
						(b.prototype.imulK = function (t) {
							for (var r = 0, i = 0; i < t.length; i++) {
								var e = 19 * (0 | t.words[i]) + r,
									n = 67108863 & e;
								(e >>>= 26), (t.words[i] = n), (r = e);
							}
							return 0 !== r && (t.words[t.length++] = r), t;
						}),
						(o._prime = function (t) {
							if (g[t]) return g[t];
							var r;
							if ('k256' === t) r = new y();
							else if ('p224' === t) r = new w();
							else if ('p192' === t) r = new M();
							else {
								if ('p25519' !== t) throw new Error('Unknown prime ' + t);
								r = new b();
							}
							return (g[t] = r), r;
						}),
						(_.prototype._verify1 = function (t) {
							e(0 === t.negative, 'red works only with positives'),
								e(t.red, 'red works only with red numbers');
						}),
						(_.prototype._verify2 = function (t, r) {
							e(0 == (t.negative | r.negative), 'red works only with positives'),
								e(t.red && t.red === r.red, 'red works only with red numbers');
						}),
						(_.prototype.imod = function (t) {
							return this.prime
								? this.prime.ireduce(t)._forceRed(this)
								: t.umod(this.m)._forceRed(this);
						}),
						(_.prototype.neg = function (t) {
							return t.isZero() ? t.clone() : this.m.sub(t)._forceRed(this);
						}),
						(_.prototype.add = function (t, r) {
							this._verify2(t, r);
							var i = t.add(r);
							return i.cmp(this.m) >= 0 && i.isub(this.m), i._forceRed(this);
						}),
						(_.prototype.iadd = function (t, r) {
							this._verify2(t, r);
							var i = t.iadd(r);
							return i.cmp(this.m) >= 0 && i.isub(this.m), i;
						}),
						(_.prototype.sub = function (t, r) {
							this._verify2(t, r);
							var i = t.sub(r);
							return i.cmpn(0) < 0 && i.iadd(this.m), i._forceRed(this);
						}),
						(_.prototype.isub = function (t, r) {
							this._verify2(t, r);
							var i = t.isub(r);
							return i.cmpn(0) < 0 && i.iadd(this.m), i;
						}),
						(_.prototype.shl = function (t, r) {
							return this._verify1(t), this.imod(t.ushln(r));
						}),
						(_.prototype.imul = function (t, r) {
							return this._verify2(t, r), this.imod(t.imul(r));
						}),
						(_.prototype.mul = function (t, r) {
							return this._verify2(t, r), this.imod(t.mul(r));
						}),
						(_.prototype.isqr = function (t) {
							return this.imul(t, t.clone());
						}),
						(_.prototype.sqr = function (t) {
							return this.mul(t, t);
						}),
						(_.prototype.sqrt = function (t) {
							if (t.isZero()) return t.clone();
							var r = this.m.andln(3);
							if ((e(r % 2 == 1), 3 === r)) {
								var i = this.m.add(new o(1)).iushrn(2);
								return this.pow(t, i);
							}
							for (var n = this.m.subn(1), s = 0; !n.isZero() && 0 === n.andln(1); )
								s++, n.iushrn(1);
							e(!n.isZero());
							var h = new o(1).toRed(this),
								u = h.redNeg(),
								a = this.m.subn(1).iushrn(1),
								l = this.m.bitLength();
							for (l = new o(2 * l * l).toRed(this); 0 !== this.pow(l, a).cmp(u); ) l.redIAdd(u);
							for (
								var f = this.pow(l, n),
									m = this.pow(t, n.addn(1).iushrn(1)),
									c = this.pow(t, n),
									d = s;
								0 !== c.cmp(h);

							) {
								for (var p = c, g = 0; 0 !== p.cmp(h); g++) p = p.redSqr();
								e(g < d);
								var v = this.pow(f, new o(1).iushln(d - g - 1));
								(m = m.redMul(v)), (f = v.redSqr()), (c = c.redMul(f)), (d = g);
							}
							return m;
						}),
						(_.prototype.invm = function (t) {
							var r = t._invmp(this.m);
							return 0 !== r.negative ? ((r.negative = 0), this.imod(r).redNeg()) : this.imod(r);
						}),
						(_.prototype.pow = function (t, r) {
							if (r.isZero()) return new o(1);
							if (0 === r.cmpn(1)) return t.clone();
							var i = new Array(16);
							(i[0] = new o(1).toRed(this)), (i[1] = t);
							for (var e = 2; e < i.length; e++) i[e] = this.mul(i[e - 1], t);
							var n = i[0],
								s = 0,
								h = 0,
								u = r.bitLength() % 26;
							for (0 === u && (u = 26), e = r.length - 1; e >= 0; e--) {
								for (var a = r.words[e], l = u - 1; l >= 0; l--) {
									var f = (a >> l) & 1;
									n !== i[0] && (n = this.sqr(n)),
										0 !== f || 0 !== s
											? ((s <<= 1),
											  (s |= f),
											  (4 === ++h || (0 === e && 0 === l)) &&
													((n = this.mul(n, i[s])), (h = 0), (s = 0)))
											: (h = 0);
								}
								u = 26;
							}
							return n;
						}),
						(_.prototype.convertTo = function (t) {
							var r = t.umod(this.m);
							return r === t ? r.clone() : r;
						}),
						(_.prototype.convertFrom = function (t) {
							var r = t.clone();
							return (r.red = null), r;
						}),
						(o.mont = function (t) {
							return new A(t);
						}),
						n(A, _),
						(A.prototype.convertTo = function (t) {
							return this.imod(t.ushln(this.shift));
						}),
						(A.prototype.convertFrom = function (t) {
							var r = this.imod(t.mul(this.rinv));
							return (r.red = null), r;
						}),
						(A.prototype.imul = function (t, r) {
							if (t.isZero() || r.isZero()) return (t.words[0] = 0), (t.length = 1), t;
							var i = t.imul(r),
								e = i.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
								n = i.isub(e).iushrn(this.shift),
								o = n;
							return (
								n.cmp(this.m) >= 0 ? (o = n.isub(this.m)) : n.cmpn(0) < 0 && (o = n.iadd(this.m)),
								o._forceRed(this)
							);
						}),
						(A.prototype.mul = function (t, r) {
							if (t.isZero() || r.isZero()) return new o(0)._forceRed(this);
							var i = t.mul(r),
								e = i.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
								n = i.isub(e).iushrn(this.shift),
								s = n;
							return (
								n.cmp(this.m) >= 0 ? (s = n.isub(this.m)) : n.cmpn(0) < 0 && (s = n.iadd(this.m)),
								s._forceRed(this)
							);
						}),
						(A.prototype.invm = function (t) {
							return this.imod(t._invmp(this.m).mul(this.r2))._forceRed(this);
						});
				})(t, this);
			}.call(this, i(0)(t)));
		},
		function (t, r, i) {
			var e = i(27);
			t.exports = function (t) {
				return 'string' != typeof t ? t : e(t) ? t.slice(2) : t;
			};
		},
		function (t, r) {
			t.exports = function (t) {
				if ('string' != typeof t)
					throw new Error(
						"[is-hex-prefixed] value must be type 'string', is currently type " +
							typeof t +
							', while checking isHexPrefixed.'
					);
				return '0x' === t.slice(0, 2);
			};
		},
		function (t, r) {},
		function (t, r) {
			var i = '0123456789abcdef'.split(''),
				e = [1, 256, 65536, 16777216],
				n = [0, 8, 16, 24],
				o = [
					1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907, 0, 2147483649, 0,
					2147516545, 2147483648, 32777, 2147483648, 138, 0, 136, 0, 2147516425, 0, 2147483658, 0,
					2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771, 2147483648, 32770, 2147483648,
					128, 2147483648, 32778, 0, 2147483658, 2147483648, 2147516545, 2147483648, 32896,
					2147483648, 2147483649, 0, 2147516424, 2147483648,
				],
				s = function (t) {
					var r,
						i,
						e,
						n,
						s,
						h,
						u,
						a,
						l,
						f,
						m,
						c,
						d,
						p,
						g,
						v,
						y,
						w,
						M,
						b,
						_,
						A,
						E,
						x,
						S,
						N,
						T,
						R,
						k,
						I,
						B,
						O,
						C,
						L,
						j,
						P,
						U,
						F,
						D,
						Z,
						z,
						q,
						H,
						W,
						G,
						Y,
						$,
						V,
						J,
						K,
						X,
						Q,
						tt,
						rt,
						it,
						et,
						nt,
						ot,
						st,
						ht,
						ut,
						at,
						lt;
					for (e = 0; e < 48; e += 2)
						(n = t[0] ^ t[10] ^ t[20] ^ t[30] ^ t[40]),
							(s = t[1] ^ t[11] ^ t[21] ^ t[31] ^ t[41]),
							(h = t[2] ^ t[12] ^ t[22] ^ t[32] ^ t[42]),
							(u = t[3] ^ t[13] ^ t[23] ^ t[33] ^ t[43]),
							(a = t[4] ^ t[14] ^ t[24] ^ t[34] ^ t[44]),
							(l = t[5] ^ t[15] ^ t[25] ^ t[35] ^ t[45]),
							(f = t[6] ^ t[16] ^ t[26] ^ t[36] ^ t[46]),
							(m = t[7] ^ t[17] ^ t[27] ^ t[37] ^ t[47]),
							(r = (c = t[8] ^ t[18] ^ t[28] ^ t[38] ^ t[48]) ^ ((h << 1) | (u >>> 31))),
							(i = (d = t[9] ^ t[19] ^ t[29] ^ t[39] ^ t[49]) ^ ((u << 1) | (h >>> 31))),
							(t[0] ^= r),
							(t[1] ^= i),
							(t[10] ^= r),
							(t[11] ^= i),
							(t[20] ^= r),
							(t[21] ^= i),
							(t[30] ^= r),
							(t[31] ^= i),
							(t[40] ^= r),
							(t[41] ^= i),
							(r = n ^ ((a << 1) | (l >>> 31))),
							(i = s ^ ((l << 1) | (a >>> 31))),
							(t[2] ^= r),
							(t[3] ^= i),
							(t[12] ^= r),
							(t[13] ^= i),
							(t[22] ^= r),
							(t[23] ^= i),
							(t[32] ^= r),
							(t[33] ^= i),
							(t[42] ^= r),
							(t[43] ^= i),
							(r = h ^ ((f << 1) | (m >>> 31))),
							(i = u ^ ((m << 1) | (f >>> 31))),
							(t[4] ^= r),
							(t[5] ^= i),
							(t[14] ^= r),
							(t[15] ^= i),
							(t[24] ^= r),
							(t[25] ^= i),
							(t[34] ^= r),
							(t[35] ^= i),
							(t[44] ^= r),
							(t[45] ^= i),
							(r = a ^ ((c << 1) | (d >>> 31))),
							(i = l ^ ((d << 1) | (c >>> 31))),
							(t[6] ^= r),
							(t[7] ^= i),
							(t[16] ^= r),
							(t[17] ^= i),
							(t[26] ^= r),
							(t[27] ^= i),
							(t[36] ^= r),
							(t[37] ^= i),
							(t[46] ^= r),
							(t[47] ^= i),
							(r = f ^ ((n << 1) | (s >>> 31))),
							(i = m ^ ((s << 1) | (n >>> 31))),
							(t[8] ^= r),
							(t[9] ^= i),
							(t[18] ^= r),
							(t[19] ^= i),
							(t[28] ^= r),
							(t[29] ^= i),
							(t[38] ^= r),
							(t[39] ^= i),
							(t[48] ^= r),
							(t[49] ^= i),
							(p = t[0]),
							(g = t[1]),
							(Y = (t[11] << 4) | (t[10] >>> 28)),
							($ = (t[10] << 4) | (t[11] >>> 28)),
							(R = (t[20] << 3) | (t[21] >>> 29)),
							(k = (t[21] << 3) | (t[20] >>> 29)),
							(ht = (t[31] << 9) | (t[30] >>> 23)),
							(ut = (t[30] << 9) | (t[31] >>> 23)),
							(q = (t[40] << 18) | (t[41] >>> 14)),
							(H = (t[41] << 18) | (t[40] >>> 14)),
							(L = (t[2] << 1) | (t[3] >>> 31)),
							(j = (t[3] << 1) | (t[2] >>> 31)),
							(v = (t[13] << 12) | (t[12] >>> 20)),
							(y = (t[12] << 12) | (t[13] >>> 20)),
							(V = (t[22] << 10) | (t[23] >>> 22)),
							(J = (t[23] << 10) | (t[22] >>> 22)),
							(I = (t[33] << 13) | (t[32] >>> 19)),
							(B = (t[32] << 13) | (t[33] >>> 19)),
							(at = (t[42] << 2) | (t[43] >>> 30)),
							(lt = (t[43] << 2) | (t[42] >>> 30)),
							(rt = (t[5] << 30) | (t[4] >>> 2)),
							(it = (t[4] << 30) | (t[5] >>> 2)),
							(P = (t[14] << 6) | (t[15] >>> 26)),
							(U = (t[15] << 6) | (t[14] >>> 26)),
							(w = (t[25] << 11) | (t[24] >>> 21)),
							(M = (t[24] << 11) | (t[25] >>> 21)),
							(K = (t[34] << 15) | (t[35] >>> 17)),
							(X = (t[35] << 15) | (t[34] >>> 17)),
							(O = (t[45] << 29) | (t[44] >>> 3)),
							(C = (t[44] << 29) | (t[45] >>> 3)),
							(x = (t[6] << 28) | (t[7] >>> 4)),
							(S = (t[7] << 28) | (t[6] >>> 4)),
							(et = (t[17] << 23) | (t[16] >>> 9)),
							(nt = (t[16] << 23) | (t[17] >>> 9)),
							(F = (t[26] << 25) | (t[27] >>> 7)),
							(D = (t[27] << 25) | (t[26] >>> 7)),
							(b = (t[36] << 21) | (t[37] >>> 11)),
							(_ = (t[37] << 21) | (t[36] >>> 11)),
							(Q = (t[47] << 24) | (t[46] >>> 8)),
							(tt = (t[46] << 24) | (t[47] >>> 8)),
							(W = (t[8] << 27) | (t[9] >>> 5)),
							(G = (t[9] << 27) | (t[8] >>> 5)),
							(N = (t[18] << 20) | (t[19] >>> 12)),
							(T = (t[19] << 20) | (t[18] >>> 12)),
							(ot = (t[29] << 7) | (t[28] >>> 25)),
							(st = (t[28] << 7) | (t[29] >>> 25)),
							(Z = (t[38] << 8) | (t[39] >>> 24)),
							(z = (t[39] << 8) | (t[38] >>> 24)),
							(A = (t[48] << 14) | (t[49] >>> 18)),
							(E = (t[49] << 14) | (t[48] >>> 18)),
							(t[0] = p ^ (~v & w)),
							(t[1] = g ^ (~y & M)),
							(t[10] = x ^ (~N & R)),
							(t[11] = S ^ (~T & k)),
							(t[20] = L ^ (~P & F)),
							(t[21] = j ^ (~U & D)),
							(t[30] = W ^ (~Y & V)),
							(t[31] = G ^ (~$ & J)),
							(t[40] = rt ^ (~et & ot)),
							(t[41] = it ^ (~nt & st)),
							(t[2] = v ^ (~w & b)),
							(t[3] = y ^ (~M & _)),
							(t[12] = N ^ (~R & I)),
							(t[13] = T ^ (~k & B)),
							(t[22] = P ^ (~F & Z)),
							(t[23] = U ^ (~D & z)),
							(t[32] = Y ^ (~V & K)),
							(t[33] = $ ^ (~J & X)),
							(t[42] = et ^ (~ot & ht)),
							(t[43] = nt ^ (~st & ut)),
							(t[4] = w ^ (~b & A)),
							(t[5] = M ^ (~_ & E)),
							(t[14] = R ^ (~I & O)),
							(t[15] = k ^ (~B & C)),
							(t[24] = F ^ (~Z & q)),
							(t[25] = D ^ (~z & H)),
							(t[34] = V ^ (~K & Q)),
							(t[35] = J ^ (~X & tt)),
							(t[44] = ot ^ (~ht & at)),
							(t[45] = st ^ (~ut & lt)),
							(t[6] = b ^ (~A & p)),
							(t[7] = _ ^ (~E & g)),
							(t[16] = I ^ (~O & x)),
							(t[17] = B ^ (~C & S)),
							(t[26] = Z ^ (~q & L)),
							(t[27] = z ^ (~H & j)),
							(t[36] = K ^ (~Q & W)),
							(t[37] = X ^ (~tt & G)),
							(t[46] = ht ^ (~at & rt)),
							(t[47] = ut ^ (~lt & it)),
							(t[8] = A ^ (~p & v)),
							(t[9] = E ^ (~g & y)),
							(t[18] = O ^ (~x & N)),
							(t[19] = C ^ (~S & T)),
							(t[28] = q ^ (~L & P)),
							(t[29] = H ^ (~j & U)),
							(t[38] = Q ^ (~W & Y)),
							(t[39] = tt ^ (~G & $)),
							(t[48] = at ^ (~rt & et)),
							(t[49] = lt ^ (~it & nt)),
							(t[0] ^= o[e]),
							(t[1] ^= o[e + 1]);
				},
				h = function (t) {
					return function (r) {
						var o;
						if ('0x' === r.slice(0, 2)) {
							o = [];
							for (var h = 2, u = r.length; h < u; h += 2) o.push(parseInt(r.slice(h, h + 2), 16));
						} else o = r;
						return (function (t, r) {
							for (
								var o,
									h = r.length,
									u = t.blocks,
									a = t.blockCount << 2,
									l = t.blockCount,
									f = t.outputBlocks,
									m = t.s,
									c = 0;
								c < h;

							) {
								if (t.reset) for (t.reset = !1, u[0] = t.block, g = 1; g < l + 1; ++g) u[g] = 0;
								if ('string' != typeof r)
									for (g = t.start; c < h && g < a; ++c) u[g >> 2] |= r[c] << n[3 & g++];
								else
									for (g = t.start; c < h && g < a; ++c)
										(o = r.charCodeAt(c)) < 128
											? (u[g >> 2] |= o << n[3 & g++])
											: o < 2048
											? ((u[g >> 2] |= (192 | (o >> 6)) << n[3 & g++]),
											  (u[g >> 2] |= (128 | (63 & o)) << n[3 & g++]))
											: o < 55296 || o >= 57344
											? ((u[g >> 2] |= (224 | (o >> 12)) << n[3 & g++]),
											  (u[g >> 2] |= (128 | ((o >> 6) & 63)) << n[3 & g++]),
											  (u[g >> 2] |= (128 | (63 & o)) << n[3 & g++]))
											: ((o = 65536 + (((1023 & o) << 10) | (1023 & r.charCodeAt(++c)))),
											  (u[g >> 2] |= (240 | (o >> 18)) << n[3 & g++]),
											  (u[g >> 2] |= (128 | ((o >> 12) & 63)) << n[3 & g++]),
											  (u[g >> 2] |= (128 | ((o >> 6) & 63)) << n[3 & g++]),
											  (u[g >> 2] |= (128 | (63 & o)) << n[3 & g++]));
								if (((t.lastByteIndex = g), g >= a)) {
									for (t.start = g - a, t.block = u[l], g = 0; g < l; ++g) m[g] ^= u[g];
									s(m), (t.reset = !0);
								} else t.start = g;
							}
							if (((u[(g = t.lastByteIndex) >> 2] |= e[3 & g]), t.lastByteIndex === a))
								for (u[0] = u[l], g = 1; g < l + 1; ++g) u[g] = 0;
							for (u[l - 1] |= 2147483648, g = 0; g < l; ++g) m[g] ^= u[g];
							s(m);
							for (var d, p = '', g = 0, v = 0; v < f; ) {
								for (g = 0; g < l && v < f; ++g, ++v)
									(d = m[g]),
										(p +=
											i[(d >> 4) & 15] +
											i[15 & d] +
											i[(d >> 12) & 15] +
											i[(d >> 8) & 15] +
											i[(d >> 20) & 15] +
											i[(d >> 16) & 15] +
											i[(d >> 28) & 15] +
											i[(d >> 24) & 15]);
								v % l == 0 && (s(m), (g = 0));
							}
							return '0x' + p;
						})(
							(function (t) {
								return {
									blocks: [],
									reset: !0,
									block: 0,
									start: 0,
									blockCount: (1600 - (t << 1)) >> 5,
									outputBlocks: t >> 5,
									s: ((r = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), [].concat(r, r, r, r, r)),
								};
								var r;
							})(t),
							o
						);
					};
				};
			t.exports = { keccak256: h(256), keccak512: h(512), keccak256s: h(256), keccak512s: h(512) };
		},
		function (t, r, i) {
			'use strict';
			Object.defineProperty(r, '__esModule', { value: !0 });
			const e = i(7);
			function n(t) {
				if (null == t) throw new Error('cannot convert null value to array');
				if ('string' == typeof t) {
					const r = t.match(/^(0x)?[0-9a-fA-F]*$/);
					if (!r) throw new Error('invalid hexidecimal string');
					if ('0x' !== r[1]) throw new Error('hex string must have 0x prefix');
					(t = t.substring(2)).length % 2 && (t = '0' + t);
					const i = [];
					for (let r = 0; r < t.length; r += 2) i.push(parseInt(t.substr(r, 2), 16));
					return o(new Uint8Array(i));
				}
				if (
					(function (t) {
						if (!t || parseInt(String(t.length)) != t.length || 'string' == typeof t) return !1;
						for (let r = 0; r < t.length; r++) {
							const i = t[r];
							if (i < 0 || i >= 256 || parseInt(String(i)) != i) return !1;
						}
						return !0;
					})(t)
				)
					return o(new Uint8Array(t));
				throw new Error('invalid arrayify value');
			}
			function o(t) {
				return (
					void 0 !== t.slice ||
						(t.slice = () => {
							const r = Array.prototype.slice.call(arguments);
							return o(new Uint8Array(Array.prototype.slice.apply(t, r)));
						}),
					t
				);
			}
			(r.keccak256 = function (t) {
				return '0x' + e.keccak_256(n(t));
			}),
				(r.padLeft = (t, r) => {
					const i = /^0x/i.test(t) || 'number' == typeof t,
						e = r - (t = t.toString().replace(/^0x/i, '')).length + 1 >= 0 ? r - t.length + 1 : 0;
					return (i ? '0x' : '') + new Array(e).join('0') + t;
				}),
				(r.bytesToHex = function (t) {
					const r = [];
					for (let i = 0; i < t.length; i++)
						r.push((t[i] >>> 4).toString(16)), r.push((15 & t[i]).toString(16));
					return '0x' + r.join('').replace(/^0+/, '');
				}),
				(r.toByteArray = n);
		},
		function (t, r) {
			(function (r) {
				t.exports = r;
			}.call(this, {}));
		},
		function (t, r, i) {
			var e = i(4),
				n = i(11),
				o = i(10),
				s = function (t) {
					var r = typeof t;
					if ('string' === r)
						return o.isHexStrict(t) ? new n(t.replace(/0x/i, ''), 16) : new n(t, 10);
					if ('number' === r) return new n(t);
					if (o.isBigNumber(t)) return new n(t.toString(10));
					if (o.isBN(t)) return t;
					throw new Error(t + ' is not a number');
				},
				h = function (t, r, i) {
					var e, h, u;
					if (
						'bytes' ===
						(t = (u = t).startsWith('int[')
							? 'int256' + u.slice(3)
							: 'int' === u
							? 'int256'
							: u.startsWith('uint[')
							? 'uint256' + u.slice(4)
							: 'uint' === u
							? 'uint256'
							: u.startsWith('fixed[')
							? 'fixed128x128' + u.slice(5)
							: 'fixed' === u
							? 'fixed128x128'
							: u.startsWith('ufixed[')
							? 'ufixed128x128' + u.slice(6)
							: 'ufixed' === u
							? 'ufixed128x128'
							: u)
					) {
						if (r.replace(/^0x/i, '').length % 2 != 0)
							throw new Error('Invalid bytes characters ' + r.length);
						return r;
					}
					if ('string' === t) return o.utf8ToHex(r);
					if ('bool' === t) return r ? '01' : '00';
					if (t.startsWith('address')) {
						if (((e = i ? 64 : 40), !o.isAddress(r)))
							throw new Error(r + ' is not a valid address, or the checksum is invalid.');
						return o.leftPad(r.toLowerCase(), e);
					}
					if (
						((e = (function (t) {
							var r = /^\D+(\d+).*$/.exec(t);
							return r ? parseInt(r[1], 10) : null;
						})(t)),
						t.startsWith('bytes'))
					) {
						if (!e) throw new Error('bytes[] not yet supported in solidity');
						if ((i && (e = 32), e < 1 || e > 32 || e < r.replace(/^0x/i, '').length / 2))
							throw new Error('Invalid bytes' + e + ' for ' + r);
						return o.rightPad(r, 2 * e);
					}
					if (t.startsWith('uint')) {
						if (e % 8 || e < 8 || e > 256) throw new Error('Invalid uint' + e + ' size');
						if ((h = s(r)).bitLength() > e)
							throw new Error('Supplied uint exceeds width: ' + e + ' vs ' + h.bitLength());
						if (h.lt(new n(0))) throw new Error('Supplied uint ' + h.toString() + ' is negative');
						return e ? o.leftPad(h.toString('hex'), (e / 8) * 2) : h;
					}
					if (t.startsWith('int')) {
						if (e % 8 || e < 8 || e > 256) throw new Error('Invalid int' + e + ' size');
						if ((h = s(r)).bitLength() > e)
							throw new Error('Supplied int exceeds width: ' + e + ' vs ' + h.bitLength());
						return h.lt(new n(0))
							? h.toTwos(e).toString('hex')
							: e
							? o.leftPad(h.toString('hex'), (e / 8) * 2)
							: h;
					}
					throw new Error('Unsupported or invalid type: ' + t);
				},
				u = function (t) {
					if (e.isArray(t)) throw new Error('Autodetection of array types is not supported.');
					var r,
						i,
						s = '';
					if (
						(e.isObject(t) &&
						(t.hasOwnProperty('v') ||
							t.hasOwnProperty('t') ||
							t.hasOwnProperty('value') ||
							t.hasOwnProperty('type'))
							? ((r = t.hasOwnProperty('t') ? t.t : t.type),
							  (s = t.hasOwnProperty('v') ? t.v : t.value))
							: ((r = o.toHex(t, !0)),
							  (s = o.toHex(t)),
							  r.startsWith('int') || r.startsWith('uint') || (r = 'bytes')),
						(!r.startsWith('int') && !r.startsWith('uint')) ||
							'string' != typeof s ||
							/^(-)?0x/i.test(s) ||
							(s = new n(s)),
						e.isArray(s))
					) {
						if (
							(i = (function (t) {
								var r = /^\D+\d*\[(\d+)\]$/.exec(t);
								return r ? parseInt(r[1], 10) : null;
							})(r)) &&
							s.length !== i
						)
							throw new Error(r + ' is not matching the given array ' + JSON.stringify(s));
						i = s.length;
					}
					return e.isArray(s)
						? s
								.map(function (t) {
									return h(r, t, i).toString('hex').replace('0x', '');
								})
								.join('')
						: h(r, s, i).toString('hex').replace('0x', '');
				};
			t.exports = function () {
				var t = Array.prototype.slice.call(arguments),
					r = e.map(t, u);
				return o.sha3('0x' + r.join(''));
			};
		},
		function (t, r, i) {
			/*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
			var e = i(1),
				n = e.Buffer;
			function o(t, r) {
				for (var i in t) r[i] = t[i];
			}
			function s(t, r, i) {
				return n(t, r, i);
			}
			n.from && n.alloc && n.allocUnsafe && n.allocUnsafeSlow
				? (t.exports = e)
				: (o(e, r), (r.Buffer = s)),
				(s.prototype = Object.create(n.prototype)),
				o(n, s),
				(s.from = function (t, r, i) {
					if ('number' == typeof t) throw new TypeError('Argument must not be a number');
					return n(t, r, i);
				}),
				(s.alloc = function (t, r, i) {
					if ('number' != typeof t) throw new TypeError('Argument must be a number');
					var e = n(t);
					return void 0 !== r ? ('string' == typeof i ? e.fill(r, i) : e.fill(r)) : e.fill(0), e;
				}),
				(s.allocUnsafe = function (t) {
					if ('number' != typeof t) throw new TypeError('Argument must be a number');
					return n(t);
				}),
				(s.allocUnsafeSlow = function (t) {
					if ('number' != typeof t) throw new TypeError('Argument must be a number');
					return e.SlowBuffer(t);
				});
		},
		function (t, r, i) {
			const { sha3: e, BN: n } = i(8),
				o = i(35),
				s = { savedABIs: [], methodIDs: {} };
			function h(t) {
				return 'tuple' === t.type ? '(' + t.components.map(h).join(',') + ')' : t.type;
			}
			t.exports = {
				getABIs: function () {
					return s.savedABIs;
				},
				addABI: function (t) {
					if (!Array.isArray(t)) throw new Error('Expected ABI array, got ' + typeof t);
					t.map(function (t) {
						if (t.name) {
							const r = e(t.name + '(' + t.inputs.map(h).join(',') + ')');
							'event' === t.type
								? (s.methodIDs[r.slice(2)] = t)
								: (s.methodIDs[r.slice(2, 10)] = t);
						}
					}),
						(s.savedABIs = s.savedABIs.concat(t));
				},
				getMethodIDs: function () {
					return s.methodIDs;
				},
				decodeMethod: function (t) {
					const r = t.slice(2, 10),
						i = s.methodIDs[r];
					if (i) {
						let r = o.decodeParameters(i.inputs, t.slice(10)),
							e = { name: i.name, params: [] };
						for (let t = 0; t < r.__length__; t++) {
							let o = r[t],
								s = o;
							const h = 0 === i.inputs[t].type.indexOf('uint'),
								u = 0 === i.inputs[t].type.indexOf('int'),
								a = 0 === i.inputs[t].type.indexOf('address');
							if (h || u) {
								s = Array.isArray(o) ? o.map((t) => new n(t).toString()) : new n(o).toString();
							}
							if (a) {
								s = Array.isArray(o) ? o.map((t) => t.toLowerCase()) : o.toLowerCase();
							}
							e.params.push({ name: i.inputs[t].name, value: s, type: i.inputs[t].type });
						}
						return e;
					}
				},
				decodeLogs: function (t) {
					return t
						.filter((t) => t.topics.length > 0)
						.map((t) => {
							const r = t.topics[0].slice(2),
								i = s.methodIDs[r];
							if (i) {
								const r = t.data;
								let e = [],
									s = 0,
									h = 1,
									u = [];
								i.inputs.map(function (t) {
									t.indexed || u.push(t.type);
								});
								const a = o.decodeParameters(u, r.slice(2));
								return (
									i.inputs.map(function (r) {
										let i = { name: r.name, type: r.type };
										if (
											(r.indexed ? ((i.value = t.topics[h]), h++) : ((i.value = a[s]), s++),
											'address' === r.type &&
												((i.value = i.value.toLowerCase()), i.value.length > 42))
										) {
											let t = i.value.length - 42,
												r = i.value.split('');
											r.splice(2, t), (i.value = r.join(''));
										}
										('uint256' !== r.type && 'uint8' !== r.type && 'int' !== r.type) ||
											('string' == typeof i.value && i.value.startsWith('0x')
												? (i.value = new n(i.value.slice(2), 16).toString(10))
												: (i.value = new n(i.value).toString(10))),
											e.push(i);
									}),
									{ name: i.name, events: e, address: t.address }
								);
							}
						});
				},
				removeABI: function (t) {
					if (!Array.isArray(t)) throw new Error('Expected ABI array, got ' + typeof t);
					t.map(function (t) {
						if (t.name) {
							const r = e(
								t.name +
									'(' +
									t.inputs
										.map(function (t) {
											return t.type;
										})
										.join(',') +
									')'
							);
							'event' === t.type
								? s.methodIDs[r.slice(2)] && delete s.methodIDs[r.slice(2)]
								: s.methodIDs[r.slice(2, 10)] && delete s.methodIDs[r.slice(2, 10)];
						}
					});
				},
			};
		},
		function (t, r, i) {
			var e = i(1).Buffer,
				n = i(36),
				o = i(17).AbiCoder,
				s = i(17).ParamType,
				h = new o(function (t, r) {
					return !t.match(/^u?int/) ||
						Array.isArray(r) ||
						(r && 'object' == typeof r && 'BN' === r.constructor.name)
						? r
						: r.toString();
				});
			function u() {}
			var a = function () {};
			(a.prototype.encodeFunctionSignature = function (t) {
				return (
					('function' == typeof t || ('object' == typeof t && t)) &&
						(t = n._jsonInterfaceMethodToString(t)),
					n.sha3(t).slice(0, 10)
				);
			}),
				(a.prototype.encodeEventSignature = function (t) {
					return (
						('function' == typeof t || ('object' == typeof t && t)) &&
							(t = n._jsonInterfaceMethodToString(t)),
						n.sha3(t)
					);
				}),
				(a.prototype.encodeParameter = function (t, r) {
					return this.encodeParameters([t], [r]);
				}),
				(a.prototype.encodeParameters = function (t, r) {
					var i = this;
					return (
						(t = i.mapTypes(t)),
						(r = r.map(function (r, e) {
							let n = t[e];
							if (
								('object' == typeof n && n.type && (n = n.type),
								(r = i.formatParam(n, r)),
								'string' == typeof n && n.includes('tuple'))
							) {
								const t = h._getCoder(s.from(n)),
									e = (t, r) => {
										if ('array' === t.name)
											return r.map((r) => e(h._getCoder(s.from(t.type.replace('[]', ''))), r));
										t.coders.forEach((t, n) => {
											'tuple' === t.name ? e(t, r[n]) : (r[n] = i.formatParam(t.name, r[n]));
										});
									};
								e(t, r);
							}
							return r;
						})),
						h.encode(t, r)
					);
				}),
				(a.prototype.mapTypes = function (t) {
					var r = this,
						i = [];
					return (
						t.forEach(function (t) {
							if (
								('object' == typeof t &&
									'function' === t.type &&
									(t = Object.assign({}, t, { type: 'bytes24' })),
								r.isSimplifiedStructFormat(t))
							) {
								var e = Object.keys(t)[0];
								i.push(
									Object.assign(r.mapStructNameAndType(e), {
										components: r.mapStructToCoderFormat(t[e]),
									})
								);
							} else i.push(t);
						}),
						i
					);
				}),
				(a.prototype.isSimplifiedStructFormat = function (t) {
					return 'object' == typeof t && void 0 === t.components && void 0 === t.name;
				}),
				(a.prototype.mapStructNameAndType = function (t) {
					var r = 'tuple';
					return (
						t.indexOf('[]') > -1 && ((r = 'tuple[]'), (t = t.slice(0, -2))), { type: r, name: t }
					);
				}),
				(a.prototype.mapStructToCoderFormat = function (t) {
					var r = this,
						i = [];
					return (
						Object.keys(t).forEach(function (e) {
							'object' != typeof t[e]
								? i.push({ name: e, type: t[e] })
								: i.push(
										Object.assign(r.mapStructNameAndType(e), {
											components: r.mapStructToCoderFormat(t[e]),
										})
								  );
						}),
						i
					);
				}),
				(a.prototype.formatParam = function (t, r) {
					const i = new RegExp(/^bytes([0-9]*)$/),
						o = new RegExp(/^bytes([0-9]*)\[\]$/),
						s = new RegExp(/^(u?int)([0-9]*)$/),
						h = new RegExp(/^(u?int)([0-9]*)\[\]$/);
					if (n.isBN(r) || n.isBigNumber(r)) return r.toString(10);
					if (t.match(o) || t.match(h))
						return r.map((r) => this.formatParam(t.replace('[]', ''), r));
					let u = t.match(s);
					if (u) {
						let t = parseInt(u[2] || '256');
						t / 8 < r.length && (r = n.leftPad(r, t));
					}
					if (((u = t.match(i)), u)) {
						e.isBuffer(r) && (r = n.toHex(r));
						let t = parseInt(u[1]);
						if (t) {
							let i = 2 * t;
							'0x' === r.substring(0, 2) && (i += 2), r.length < i && (r = n.rightPad(r, 2 * t));
						}
						r.length % 2 == 1 && (r = '0x0' + r.substring(2));
					}
					return r;
				}),
				(a.prototype.encodeFunctionCall = function (t, r) {
					return (
						this.encodeFunctionSignature(t) + this.encodeParameters(t.inputs, r).replace('0x', '')
					);
				}),
				(a.prototype.decodeParameter = function (t, r) {
					return this.decodeParameters([t], r)[0];
				}),
				(a.prototype.decodeParameters = function (t, r) {
					return this.decodeParametersWith(t, r, !1);
				}),
				(a.prototype.decodeParametersWith = function (t, r, i) {
					if (t.length > 0 && (!r || '0x' === r || '0X' === r))
						throw new Error(
							"Returned values aren't valid, did it run Out of Gas? You might also see this error if you are not using the correct ABI for the contract you are retrieving data from, requesting data from a block number that does not exist, or querying a node which is not fully synced."
						);
					var e = h.decode(this.mapTypes(t), '0x' + r.replace(/0x/i, ''), i),
						n = new u();
					return (
						(n.__length__ = 0),
						t.forEach(function (t, r) {
							var i = e[n.__length__];
							(i = '0x' === i ? null : i),
								(n[r] = i),
								('function' == typeof t || (t && 'object' == typeof t)) &&
									t.name &&
									(n[t.name] = i),
								n.__length__++;
						}),
						n
					);
				}),
				(a.prototype.decodeLog = function (t, r, i) {
					var e = this;
					(i = Array.isArray(i) ? i : [i]), (r = r || '');
					var n = [],
						o = [],
						s = 0;
					t.forEach(function (t, r) {
						t.indexed
							? ((o[r] = ['bool', 'int', 'uint', 'address', 'fixed', 'ufixed'].find(function (r) {
									return -1 !== t.type.indexOf(r);
							  })
									? e.decodeParameter(t.type, i[s])
									: i[s]),
							  s++)
							: (n[r] = t);
					});
					var h = r,
						a = h ? this.decodeParametersWith(n, h, !0) : [],
						l = new u();
					return (
						(l.__length__ = 0),
						t.forEach(function (t, r) {
							(l[r] = 'string' === t.type ? '' : null),
								void 0 !== a[r] && (l[r] = a[r]),
								void 0 !== o[r] && (l[r] = o[r]),
								t.name && (l[t.name] = l[r]),
								l.__length__++;
						}),
						l
					);
				});
			var l = new a();
			t.exports = l;
		},
		function (t, r, i) {
			var e = i(9),
				n = i(16),
				o = i(39),
				s = i(15),
				h = i(6),
				u = function (t, r) {
					var i = [];
					return (
						r.forEach(function (r) {
							if ('object' == typeof r.components) {
								if ('tuple' !== r.type.substring(0, 5))
									throw new Error('components found but type is not tuple; report on GitHub');
								var e = '',
									n = r.type.indexOf('[');
								n >= 0 && (e = r.type.substring(n));
								var o = u(t, r.components);
								Array.isArray(o) && t
									? i.push('tuple(' + o.join(',') + ')' + e)
									: t
									? i.push('(' + o + ')')
									: i.push('(' + o.join(',') + ')' + e);
							} else i.push(r.type);
						}),
						i
					);
				},
				a = function (t) {
					if (!n.isHexStrict(t)) throw new Error('The parameter must be a valid HEX string.');
					var r = '',
						i = 0,
						e = t.length;
					for ('0x' === t.substring(0, 2) && (i = 2); i < e; i += 2) {
						var o = parseInt(t.substr(i, 2), 16);
						r += String.fromCharCode(o);
					}
					return r;
				},
				l = function (t) {
					if (!t) return '0x00';
					for (var r = '', i = 0; i < t.length; i++) {
						var e = t.charCodeAt(i).toString(16);
						r += e.length < 2 ? '0' + e : e;
					}
					return '0x' + r;
				},
				f = function (t) {
					if (((t = t ? t.toLowerCase() : 'ether'), !e.unitMap[t]))
						throw new Error(
							'This unit "' +
								t +
								'" doesn\'t exist, please use the one of the following units' +
								JSON.stringify(e.unitMap, null, 2)
						);
					return t;
				};
			t.exports = {
				_fireError: function (t, r, i, e, n) {
					return (
						!t ||
							'object' != typeof t ||
							t instanceof Error ||
							!t.data ||
							(((t.data && 'object' == typeof t.data) || Array.isArray(t.data)) &&
								(t.data = JSON.stringify(t.data, null, 2)),
							(t = t.message + '\n' + t.data)),
						'string' == typeof t && (t = new Error(t)),
						'function' == typeof e && e(t, n),
						'function' == typeof i &&
							(((r && 'function' == typeof r.listeners && r.listeners('error').length) ||
								'function' == typeof e) &&
								r.catch(function () {}),
							setTimeout(function () {
								i(t);
							}, 1)),
						r &&
							'function' == typeof r.emit &&
							setTimeout(function () {
								r.emit('error', t, n), r.removeAllListeners();
							}, 1),
						r
					);
				},
				_jsonInterfaceMethodToString: function (t) {
					return t && 'object' == typeof t && t.name && -1 !== t.name.indexOf('(')
						? t.name
						: t.name + '(' + u(!1, t.inputs).join(',') + ')';
				},
				_flattenTypes: u,
				randomHex: function (t) {
					return '0x' + s(t).toString('hex');
				},
				BN: n.BN,
				isBN: n.isBN,
				isBigNumber: n.isBigNumber,
				isHex: n.isHex,
				isHexStrict: n.isHexStrict,
				sha3: n.sha3,
				sha3Raw: n.sha3Raw,
				keccak256: n.sha3,
				soliditySha3: o.soliditySha3,
				soliditySha3Raw: o.soliditySha3Raw,
				encodePacked: o.encodePacked,
				isAddress: n.isAddress,
				checkAddressChecksum: n.checkAddressChecksum,
				toChecksumAddress: function (t) {
					if (void 0 === t) return '';
					if (!/^(0x)?[0-9a-f]{40}$/i.test(t))
						throw new Error('Given address "' + t + '" is not a valid Ethereum address.');
					t = t.toLowerCase().replace(/^0x/i, '');
					for (var r = n.sha3(t).replace(/^0x/i, ''), i = '0x', e = 0; e < t.length; e++)
						parseInt(r[e], 16) > 7 ? (i += t[e].toUpperCase()) : (i += t[e]);
					return i;
				},
				toHex: n.toHex,
				toBN: n.toBN,
				bytesToHex: n.bytesToHex,
				hexToBytes: n.hexToBytes,
				hexToNumberString: n.hexToNumberString,
				hexToNumber: n.hexToNumber,
				toDecimal: n.hexToNumber,
				numberToHex: n.numberToHex,
				fromDecimal: n.numberToHex,
				hexToUtf8: n.hexToUtf8,
				hexToString: n.hexToUtf8,
				toUtf8: n.hexToUtf8,
				stripHexPrefix: n.stripHexPrefix,
				utf8ToHex: n.utf8ToHex,
				stringToHex: n.utf8ToHex,
				fromUtf8: n.utf8ToHex,
				hexToAscii: a,
				toAscii: a,
				asciiToHex: l,
				fromAscii: l,
				unitMap: e.unitMap,
				toWei: function (t, r) {
					if (((r = f(r)), !n.isBN(t) && 'string' != typeof t))
						throw new Error(
							'Please pass numbers as strings or BN objects to avoid precision errors.'
						);
					return n.isBN(t) ? e.toWei(t, r) : e.toWei(t, r).toString(10);
				},
				fromWei: function (t, r) {
					if (((r = f(r)), !n.isBN(t) && 'string' != typeof t))
						throw new Error(
							'Please pass numbers as strings or BN objects to avoid precision errors.'
						);
					return n.isBN(t) ? e.fromWei(t, r) : e.fromWei(t, r).toString(10);
				},
				padLeft: n.leftPad,
				leftPad: n.leftPad,
				padRight: n.rightPad,
				rightPad: n.rightPad,
				toTwosComplement: n.toTwosComplement,
				isBloom: n.isBloom,
				isUserEthereumAddressInBloom: n.isUserEthereumAddressInBloom,
				isContractAddressInBloom: n.isContractAddressInBloom,
				isTopic: n.isTopic,
				isTopicInBloom: n.isTopicInBloom,
				isInBloom: n.isInBloom,
				compareBlockNumbers: function (t, r) {
					if (t == r) return 0;
					if (
						('genesis' != t && 'earliest' != t && 0 != t) ||
						('genesis' != r && 'earliest' != r && 0 != r)
					) {
						if ('genesis' == t || 'earliest' == t) return -1;
						if ('genesis' == r || 'earliest' == r) return 1;
						if ('latest' == t) return 'pending' == r ? -1 : 1;
						if ('latest' === r) return 'pending' == t ? 1 : -1;
						if ('pending' == t) return 1;
						if ('pending' == r) return -1;
						{
							let i = new h(t),
								e = new h(r);
							return i.lt(e) ? -1 : i.eq(e) ? 0 : 1;
						}
					}
					return 0;
				},
				toNumber: n.toNumber,
			};
		},
		function (t, r) {},
		function (t, r) {
			const i = '0123456789abcdef'.split(''),
				e = [1, 256, 65536, 16777216],
				n = [0, 8, 16, 24],
				o = [
					1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907, 0, 2147483649, 0,
					2147516545, 2147483648, 32777, 2147483648, 138, 0, 136, 0, 2147516425, 0, 2147483658, 0,
					2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771, 2147483648, 32770, 2147483648,
					128, 2147483648, 32778, 0, 2147483658, 2147483648, 2147516545, 2147483648, 32896,
					2147483648, 2147483649, 0, 2147516424, 2147483648,
				],
				s = (t) => {
					var r,
						i,
						e,
						n,
						s,
						h,
						u,
						a,
						l,
						f,
						m,
						c,
						d,
						p,
						g,
						v,
						y,
						w,
						M,
						b,
						_,
						A,
						E,
						x,
						S,
						N,
						T,
						R,
						k,
						I,
						B,
						O,
						C,
						L,
						j,
						P,
						U,
						F,
						D,
						Z,
						z,
						q,
						H,
						W,
						G,
						Y,
						$,
						V,
						J,
						K,
						X,
						Q,
						tt,
						rt,
						it,
						et,
						nt,
						ot,
						st,
						ht,
						ut,
						at,
						lt;
					for (e = 0; e < 48; e += 2)
						(n = t[0] ^ t[10] ^ t[20] ^ t[30] ^ t[40]),
							(s = t[1] ^ t[11] ^ t[21] ^ t[31] ^ t[41]),
							(h = t[2] ^ t[12] ^ t[22] ^ t[32] ^ t[42]),
							(u = t[3] ^ t[13] ^ t[23] ^ t[33] ^ t[43]),
							(a = t[4] ^ t[14] ^ t[24] ^ t[34] ^ t[44]),
							(l = t[5] ^ t[15] ^ t[25] ^ t[35] ^ t[45]),
							(f = t[6] ^ t[16] ^ t[26] ^ t[36] ^ t[46]),
							(m = t[7] ^ t[17] ^ t[27] ^ t[37] ^ t[47]),
							(r = (c = t[8] ^ t[18] ^ t[28] ^ t[38] ^ t[48]) ^ ((h << 1) | (u >>> 31))),
							(i = (d = t[9] ^ t[19] ^ t[29] ^ t[39] ^ t[49]) ^ ((u << 1) | (h >>> 31))),
							(t[0] ^= r),
							(t[1] ^= i),
							(t[10] ^= r),
							(t[11] ^= i),
							(t[20] ^= r),
							(t[21] ^= i),
							(t[30] ^= r),
							(t[31] ^= i),
							(t[40] ^= r),
							(t[41] ^= i),
							(r = n ^ ((a << 1) | (l >>> 31))),
							(i = s ^ ((l << 1) | (a >>> 31))),
							(t[2] ^= r),
							(t[3] ^= i),
							(t[12] ^= r),
							(t[13] ^= i),
							(t[22] ^= r),
							(t[23] ^= i),
							(t[32] ^= r),
							(t[33] ^= i),
							(t[42] ^= r),
							(t[43] ^= i),
							(r = h ^ ((f << 1) | (m >>> 31))),
							(i = u ^ ((m << 1) | (f >>> 31))),
							(t[4] ^= r),
							(t[5] ^= i),
							(t[14] ^= r),
							(t[15] ^= i),
							(t[24] ^= r),
							(t[25] ^= i),
							(t[34] ^= r),
							(t[35] ^= i),
							(t[44] ^= r),
							(t[45] ^= i),
							(r = a ^ ((c << 1) | (d >>> 31))),
							(i = l ^ ((d << 1) | (c >>> 31))),
							(t[6] ^= r),
							(t[7] ^= i),
							(t[16] ^= r),
							(t[17] ^= i),
							(t[26] ^= r),
							(t[27] ^= i),
							(t[36] ^= r),
							(t[37] ^= i),
							(t[46] ^= r),
							(t[47] ^= i),
							(r = f ^ ((n << 1) | (s >>> 31))),
							(i = m ^ ((s << 1) | (n >>> 31))),
							(t[8] ^= r),
							(t[9] ^= i),
							(t[18] ^= r),
							(t[19] ^= i),
							(t[28] ^= r),
							(t[29] ^= i),
							(t[38] ^= r),
							(t[39] ^= i),
							(t[48] ^= r),
							(t[49] ^= i),
							(p = t[0]),
							(g = t[1]),
							(Y = (t[11] << 4) | (t[10] >>> 28)),
							($ = (t[10] << 4) | (t[11] >>> 28)),
							(R = (t[20] << 3) | (t[21] >>> 29)),
							(k = (t[21] << 3) | (t[20] >>> 29)),
							(ht = (t[31] << 9) | (t[30] >>> 23)),
							(ut = (t[30] << 9) | (t[31] >>> 23)),
							(q = (t[40] << 18) | (t[41] >>> 14)),
							(H = (t[41] << 18) | (t[40] >>> 14)),
							(L = (t[2] << 1) | (t[3] >>> 31)),
							(j = (t[3] << 1) | (t[2] >>> 31)),
							(v = (t[13] << 12) | (t[12] >>> 20)),
							(y = (t[12] << 12) | (t[13] >>> 20)),
							(V = (t[22] << 10) | (t[23] >>> 22)),
							(J = (t[23] << 10) | (t[22] >>> 22)),
							(I = (t[33] << 13) | (t[32] >>> 19)),
							(B = (t[32] << 13) | (t[33] >>> 19)),
							(at = (t[42] << 2) | (t[43] >>> 30)),
							(lt = (t[43] << 2) | (t[42] >>> 30)),
							(rt = (t[5] << 30) | (t[4] >>> 2)),
							(it = (t[4] << 30) | (t[5] >>> 2)),
							(P = (t[14] << 6) | (t[15] >>> 26)),
							(U = (t[15] << 6) | (t[14] >>> 26)),
							(w = (t[25] << 11) | (t[24] >>> 21)),
							(M = (t[24] << 11) | (t[25] >>> 21)),
							(K = (t[34] << 15) | (t[35] >>> 17)),
							(X = (t[35] << 15) | (t[34] >>> 17)),
							(O = (t[45] << 29) | (t[44] >>> 3)),
							(C = (t[44] << 29) | (t[45] >>> 3)),
							(x = (t[6] << 28) | (t[7] >>> 4)),
							(S = (t[7] << 28) | (t[6] >>> 4)),
							(et = (t[17] << 23) | (t[16] >>> 9)),
							(nt = (t[16] << 23) | (t[17] >>> 9)),
							(F = (t[26] << 25) | (t[27] >>> 7)),
							(D = (t[27] << 25) | (t[26] >>> 7)),
							(b = (t[36] << 21) | (t[37] >>> 11)),
							(_ = (t[37] << 21) | (t[36] >>> 11)),
							(Q = (t[47] << 24) | (t[46] >>> 8)),
							(tt = (t[46] << 24) | (t[47] >>> 8)),
							(W = (t[8] << 27) | (t[9] >>> 5)),
							(G = (t[9] << 27) | (t[8] >>> 5)),
							(N = (t[18] << 20) | (t[19] >>> 12)),
							(T = (t[19] << 20) | (t[18] >>> 12)),
							(ot = (t[29] << 7) | (t[28] >>> 25)),
							(st = (t[28] << 7) | (t[29] >>> 25)),
							(Z = (t[38] << 8) | (t[39] >>> 24)),
							(z = (t[39] << 8) | (t[38] >>> 24)),
							(A = (t[48] << 14) | (t[49] >>> 18)),
							(E = (t[49] << 14) | (t[48] >>> 18)),
							(t[0] = p ^ (~v & w)),
							(t[1] = g ^ (~y & M)),
							(t[10] = x ^ (~N & R)),
							(t[11] = S ^ (~T & k)),
							(t[20] = L ^ (~P & F)),
							(t[21] = j ^ (~U & D)),
							(t[30] = W ^ (~Y & V)),
							(t[31] = G ^ (~$ & J)),
							(t[40] = rt ^ (~et & ot)),
							(t[41] = it ^ (~nt & st)),
							(t[2] = v ^ (~w & b)),
							(t[3] = y ^ (~M & _)),
							(t[12] = N ^ (~R & I)),
							(t[13] = T ^ (~k & B)),
							(t[22] = P ^ (~F & Z)),
							(t[23] = U ^ (~D & z)),
							(t[32] = Y ^ (~V & K)),
							(t[33] = $ ^ (~J & X)),
							(t[42] = et ^ (~ot & ht)),
							(t[43] = nt ^ (~st & ut)),
							(t[4] = w ^ (~b & A)),
							(t[5] = M ^ (~_ & E)),
							(t[14] = R ^ (~I & O)),
							(t[15] = k ^ (~B & C)),
							(t[24] = F ^ (~Z & q)),
							(t[25] = D ^ (~z & H)),
							(t[34] = V ^ (~K & Q)),
							(t[35] = J ^ (~X & tt)),
							(t[44] = ot ^ (~ht & at)),
							(t[45] = st ^ (~ut & lt)),
							(t[6] = b ^ (~A & p)),
							(t[7] = _ ^ (~E & g)),
							(t[16] = I ^ (~O & x)),
							(t[17] = B ^ (~C & S)),
							(t[26] = Z ^ (~q & L)),
							(t[27] = z ^ (~H & j)),
							(t[36] = K ^ (~Q & W)),
							(t[37] = X ^ (~tt & G)),
							(t[46] = ht ^ (~at & rt)),
							(t[47] = ut ^ (~lt & it)),
							(t[8] = A ^ (~p & v)),
							(t[9] = E ^ (~g & y)),
							(t[18] = O ^ (~x & N)),
							(t[19] = C ^ (~S & T)),
							(t[28] = q ^ (~L & P)),
							(t[29] = H ^ (~j & U)),
							(t[38] = Q ^ (~W & Y)),
							(t[39] = tt ^ (~G & $)),
							(t[48] = at ^ (~rt & et)),
							(t[49] = lt ^ (~it & nt)),
							(t[0] ^= o[e]),
							(t[1] ^= o[e + 1]);
				},
				h = (t) => (r) => {
					var o;
					if ('0x' === r.slice(0, 2)) {
						o = [];
						for (var h = 2, u = r.length; h < u; h += 2) o.push(parseInt(r.slice(h, h + 2), 16));
					} else o = r;
					return ((t, r) => {
						for (
							var o,
								h = r.length,
								u = t.blocks,
								a = t.blockCount << 2,
								l = t.blockCount,
								f = t.outputBlocks,
								m = t.s,
								c = 0;
							c < h;

						) {
							if (t.reset) for (t.reset = !1, u[0] = t.block, g = 1; g < l + 1; ++g) u[g] = 0;
							if ('string' != typeof r)
								for (g = t.start; c < h && g < a; ++c) u[g >> 2] |= r[c] << n[3 & g++];
							else
								for (g = t.start; c < h && g < a; ++c)
									(o = r.charCodeAt(c)) < 128
										? (u[g >> 2] |= o << n[3 & g++])
										: o < 2048
										? ((u[g >> 2] |= (192 | (o >> 6)) << n[3 & g++]),
										  (u[g >> 2] |= (128 | (63 & o)) << n[3 & g++]))
										: o < 55296 || o >= 57344
										? ((u[g >> 2] |= (224 | (o >> 12)) << n[3 & g++]),
										  (u[g >> 2] |= (128 | ((o >> 6) & 63)) << n[3 & g++]),
										  (u[g >> 2] |= (128 | (63 & o)) << n[3 & g++]))
										: ((o = 65536 + (((1023 & o) << 10) | (1023 & r.charCodeAt(++c)))),
										  (u[g >> 2] |= (240 | (o >> 18)) << n[3 & g++]),
										  (u[g >> 2] |= (128 | ((o >> 12) & 63)) << n[3 & g++]),
										  (u[g >> 2] |= (128 | ((o >> 6) & 63)) << n[3 & g++]),
										  (u[g >> 2] |= (128 | (63 & o)) << n[3 & g++]));
							if (((t.lastByteIndex = g), g >= a)) {
								for (t.start = g - a, t.block = u[l], g = 0; g < l; ++g) m[g] ^= u[g];
								s(m), (t.reset = !0);
							} else t.start = g;
						}
						if (((u[(g = t.lastByteIndex) >> 2] |= e[3 & g]), t.lastByteIndex === a))
							for (u[0] = u[l], g = 1; g < l + 1; ++g) u[g] = 0;
						for (u[l - 1] |= 2147483648, g = 0; g < l; ++g) m[g] ^= u[g];
						s(m);
						for (var d, p = '', g = 0, v = 0; v < f; ) {
							for (g = 0; g < l && v < f; ++g, ++v)
								(d = m[g]),
									(p +=
										i[(d >> 4) & 15] +
										i[15 & d] +
										i[(d >> 12) & 15] +
										i[(d >> 8) & 15] +
										i[(d >> 20) & 15] +
										i[(d >> 16) & 15] +
										i[(d >> 28) & 15] +
										i[(d >> 24) & 15]);
							v % l == 0 && (s(m), (g = 0));
						}
						return '0x' + p;
					})(
						((t) => {
							return {
								blocks: [],
								reset: !0,
								block: 0,
								start: 0,
								blockCount: (1600 - (t << 1)) >> 5,
								outputBlocks: t >> 5,
								s: ((r = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), [].concat(r, r, r, r, r)),
							};
							var r;
						})(t),
						o
					);
				};
			t.exports = { keccak256: h(256), keccak512: h(512), keccak256s: h(256), keccak512s: h(512) };
		},
		function (t, r, i) {
			var e = i(6),
				n = i(16),
				o = function (t) {
					var r = typeof t;
					if ('string' === r)
						return n.isHexStrict(t) ? new e(t.replace(/0x/i, ''), 16) : new e(t, 10);
					if ('number' === r) return new e(t);
					if (n.isBigNumber(t)) return new e(t.toString(10));
					if (n.isBN(t)) return t;
					throw new Error(t + ' is not a number');
				},
				s = function (t, r, i) {
					var s, h, u;
					if (
						'bytes' ===
						(t = (u = t).startsWith('int[')
							? 'int256' + u.slice(3)
							: 'int' === u
							? 'int256'
							: u.startsWith('uint[')
							? 'uint256' + u.slice(4)
							: 'uint' === u
							? 'uint256'
							: u.startsWith('fixed[')
							? 'fixed128x128' + u.slice(5)
							: 'fixed' === u
							? 'fixed128x128'
							: u.startsWith('ufixed[')
							? 'ufixed128x128' + u.slice(6)
							: 'ufixed' === u
							? 'ufixed128x128'
							: u)
					) {
						if (r.replace(/^0x/i, '').length % 2 != 0)
							throw new Error('Invalid bytes characters ' + r.length);
						return r;
					}
					if ('string' === t) return n.utf8ToHex(r);
					if ('bool' === t) return r ? '01' : '00';
					if (t.startsWith('address')) {
						if (((s = i ? 64 : 40), !n.isAddress(r)))
							throw new Error(r + ' is not a valid address, or the checksum is invalid.');
						return n.leftPad(r.toLowerCase(), s);
					}
					if (
						((s = (function (t) {
							var r = /^\D+(\d+).*$/.exec(t);
							return r ? parseInt(r[1], 10) : null;
						})(t)),
						t.startsWith('bytes'))
					) {
						if (!s) throw new Error('bytes[] not yet supported in solidity');
						if ((i && (s = 32), s < 1 || s > 32 || s < r.replace(/^0x/i, '').length / 2))
							throw new Error('Invalid bytes' + s + ' for ' + r);
						return n.rightPad(r, 2 * s);
					}
					if (t.startsWith('uint')) {
						if (s % 8 || s < 8 || s > 256) throw new Error('Invalid uint' + s + ' size');
						if ((h = o(r)).bitLength() > s)
							throw new Error('Supplied uint exceeds width: ' + s + ' vs ' + h.bitLength());
						if (h.lt(new e(0))) throw new Error('Supplied uint ' + h.toString() + ' is negative');
						return s ? n.leftPad(h.toString('hex'), (s / 8) * 2) : h;
					}
					if (t.startsWith('int')) {
						if (s % 8 || s < 8 || s > 256) throw new Error('Invalid int' + s + ' size');
						if ((h = o(r)).bitLength() > s)
							throw new Error('Supplied int exceeds width: ' + s + ' vs ' + h.bitLength());
						return h.lt(new e(0))
							? h.toTwos(s).toString('hex')
							: s
							? n.leftPad(h.toString('hex'), (s / 8) * 2)
							: h;
					}
					throw new Error('Unsupported or invalid type: ' + t);
				},
				h = function (t) {
					if (Array.isArray(t)) throw new Error('Autodetection of array types is not supported.');
					var r,
						i,
						o = '';
					if (
						(t &&
						'object' == typeof t &&
						(t.hasOwnProperty('v') ||
							t.hasOwnProperty('t') ||
							t.hasOwnProperty('value') ||
							t.hasOwnProperty('type'))
							? ((r = t.hasOwnProperty('t') ? t.t : t.type),
							  (o = t.hasOwnProperty('v') ? t.v : t.value))
							: ((r = n.toHex(t, !0)),
							  (o = n.toHex(t)),
							  r.startsWith('int') || r.startsWith('uint') || (r = 'bytes')),
						(!r.startsWith('int') && !r.startsWith('uint')) ||
							'string' != typeof o ||
							/^(-)?0x/i.test(o) ||
							(o = new e(o)),
						Array.isArray(o))
					) {
						if (
							(i = (function (t) {
								var r = /^\D+\d*\[(\d+)\]$/.exec(t);
								return r ? parseInt(r[1], 10) : null;
							})(r)) &&
							o.length !== i
						)
							throw new Error(r + ' is not matching the given array ' + JSON.stringify(o));
						i = o.length;
					}
					return Array.isArray(o)
						? o
								.map(function (t) {
									return s(r, t, i).toString('hex').replace('0x', '');
								})
								.join('')
						: s(r, o, i).toString('hex').replace('0x', '');
				};
			t.exports = {
				soliditySha3: function () {
					var t = Array.prototype.slice.call(arguments),
						r = t.map(h);
					return n.sha3('0x' + r.join(''));
				},
				soliditySha3Raw: function () {
					return n.sha3Raw('0x' + Array.prototype.slice.call(arguments).map(h).join(''));
				},
				encodePacked: function () {
					var t = Array.prototype.slice.call(arguments),
						r = t.map(h);
					return '0x' + r.join('').toLowerCase();
				},
			};
		},
		function (t, r) {},
	]);
});
