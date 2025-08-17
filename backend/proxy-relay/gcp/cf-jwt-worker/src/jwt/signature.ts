type CloudFunctionSignatureParams = {
	email: string;
	privatekey: string;
	function_deployed_endpoint: string;
};

/**
 *
 * @param email
 * @param privatekey
 */
export async function jwtSignature(params: CloudFunctionSignatureParams) {
	// SubtleCryptoを使用して署名を作成
	const buf = convertPemToBinary(params.privatekey);
	const key = await crypto.subtle.importKey(
		'pkcs8',
		buf,
		{
			name: 'RSASSA-PKCS1-v1_5',
			hash: 'SHA-256',
		},
		false,
		['sign']
	);

	// JWT生成用のヘッダーとペイロード
	const jwtHeader = {
		alg: 'RS256',
		typ: 'JWT',
	};
	const jwtPayload = {
		iss: params.email,
		sub: params.email,
		target_audience: params.function_deployed_endpoint,
		aud: `https://www.googleapis.com/oauth2/v4/token`,
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 3600,
	};

	// ヘッダーとペイロードをBase64URL形式にエンコード
	const dataToSign = `${base64UrlEncode(jwtHeader)}.${base64UrlEncode(jwtPayload)}`;

	const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(dataToSign));

	// 署名をBase64URL形式にエンコード
	const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

	// jwt
	const jwt = `${dataToSign}.${encodedSignature}`;

	const response = await fetch('https://www.googleapis.com/oauth2/v4/token', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${jwt}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt,
		}),
	});

	if (response.status != 200) {
		throw new Error('e3rt54iuj3i54uh534uhi3uhi54h3i54uuh435');
	}

	const token = await response.json<{ id_token: string }>();
	return {
		expireAt: new Date(jwtPayload.exp * 1000),
		key: token.id_token,
	};
}

function base64UrlEncode(input: object | Buffer) {
	const buffer = Buffer.isBuffer(input) ? input : Buffer.from(JSON.stringify(input));
	return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function convertPemToBinary(pem: string): ArrayBuffer {
	const base64 = pem
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\\n/g, '') // ← JSONの\\n除去
		.replace(/[\r\n]+/g, '') // CRLF or LFの実改行対応
		.replace(/\s+/g, '') // その他の空白
		.replace(/\u200B/g, '') // 不可視文字
		.trim();

	const buf = Buffer.from(base64, 'base64');
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
