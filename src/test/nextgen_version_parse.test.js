'use strict';

const { parse, fillChannelPlatform, defaultPlatform, defaultChannel } = require('../nextgen_version_parse');

// parse tests

test('ok-name', () => {
	expect(parse('gajop/test')).toStrictEqual({
		user: 'gajop',
		repo: 'test',
	});
	expect(parse('SpringBoard-Core/SpringBoard-Core')).toStrictEqual({
		user: 'SpringBoard-Core',
		repo: 'SpringBoard-Core',
	});
	expect(parse('beyond-all-reason/BYAR-Chobby')).toStrictEqual({
		user: 'beyond-all-reason',
		repo: 'BYAR-Chobby',
	});
	expect(parse('Spring-Chobby/Chobby')).toStrictEqual({
		user: 'Spring-Chobby',
		repo: 'Chobby',
	});
	expect(parse('beyond-all-reason/Beyond-All-Reason')).toStrictEqual({
		user: 'beyond-all-reason',
		repo: 'Beyond-All-Reason',
	});
});

test('bad-name', () => {
	expect(() => { parse('gajop'); }).toThrow();
	expect(() => { parse('gajop/test/a'); }).toThrow();
	expect(() => { parse(''); }).toThrow();
	expect(() => { parse('/'); }).toThrow();
	expect(() => { parse('//'); }).toThrow();
	expect(() => { parse(null); }).toThrow();
	expect(() => { parse('%/test'); }).toThrow();
	expect(() => { parse('#/test'); }).toThrow();
});

test('ok-channel', () => {
	expect(parse('gajop/test@test')).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		channel: 'test'
	});
	expect(parse('gajop/test@stable')).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		channel: 'stable'
	});
});

test('bad-channel', () => {
	expect(() => { parse('gajop/test@'); }).toThrow();
	expect(() => { parse('gajop/test@a@'); }).toThrow();
	expect(() => { parse('@agajop/test'); }).toThrow();
	expect(() => { parse('gajop/@atest'); }).toThrow();
});

test('ok-version', () => {
	expect(parse('gajop/test:123')).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		version: 123,
	});
	expect(parse('gajop/test:543')).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		version: 543,
	});
});

test('bad-version', () => {
	expect(() => { parse('gajop/test:'); }).toThrow();
	expect(() => { parse('gajop/test:aa'); }).toThrow();
	expect(() => { parse('gajop/test:1:1'); }).toThrow();
	expect(() => { parse('gajop/test:-1'); }).toThrow();
	expect(() => { parse('gajop/test:1+1'); }).toThrow();
	expect(() => { parse('gajop/test:0x64'); }).toThrow();
});

test('ok-platform', () => {
	expect(parse('gajop/test#windows-amd64')).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		platform: 'windows-amd64'
	});
	expect(parse('gajop/test#linux-amd64')).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		platform: 'linux-amd64'
	});
});

test('bad-platform', () => {
	expect(() => { parse('gajop/test#'); }).toThrow();
	expect(() => { parse('gajop/test#windows'); }).toThrow();
	expect(() => { parse('gajop/test#linux'); }).toThrow();
	expect(() => { parse('gajop/test#amd64'); }).toThrow();
	expect(() => { parse('gajop/test#windows-amd6464'); }).toThrow();
	expect(() => { parse('gajop/test#linux-amd64windows-amd64'); }).toThrow();
	expect(() => { parse('gajop/test#windows-amd64#'); }).toThrow();
});

test('ok-partial', () => {
	expect(parse('gajop/test@main:1234')).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		channel: 'main',
		version: 1234
	});
	expect(parse('gajop/test@main#linux-amd64')).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		channel: 'main',
		platform: 'linux-amd64'
	});
	expect(parse('gajop/test:1234#linux-amd64')).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		version: 1234,
		platform: 'linux-amd64'
	});
});

test('ok-full', () => {
	expect(parse('gajop/test@main:1234#windows-amd64')).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		channel: 'main',
		version: 1234,
		platform: 'windows-amd64'
	});
});

test('bad-full', () => {
	expect(() => { parse('gajop/test@test:11a'); }).toThrow();
	expect(() => { parse('gajop/test#windows-amd64:1234#windows-amd64'); }).toThrow();
});


// tryToMatchChannelPlatform tests

test('ok-match-channel-platform', () => {
	expect(
		fillChannelPlatform(
			parse('gajop/test'),
			{
				'channels': {
					[defaultChannel]: [defaultPlatform]
				}
			}
		)
	).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		channel: defaultChannel,
		platform: defaultPlatform
	});

	expect(
		fillChannelPlatform(
			parse(`gajop/test@${defaultChannel}`),
			{
				'channels': {
					[defaultChannel]: [defaultPlatform]
				}
			}
		)
	).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		channel: defaultChannel,
		platform: defaultPlatform
	});

	expect(
		fillChannelPlatform(
			parse(`gajop/test@${defaultChannel}#${defaultPlatform}`),
			{
				'channels': {
					[defaultChannel]: [defaultPlatform]
				}
			}
		)
	).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		channel: defaultChannel,
		platform: defaultPlatform
	});

	expect(
		fillChannelPlatform(
			parse(`gajop/test#${defaultPlatform}`),
			{
				'channels': {
					[defaultChannel]: [defaultPlatform]
				}
			}
		)
	).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		channel: defaultChannel,
		platform: defaultPlatform
	});

	expect(
		fillChannelPlatform(
			parse('gajop/test#any'),
			{
				'channels': {
					[defaultChannel]: [defaultPlatform]
				}
			}
		)
	).toStrictEqual({
		user: 'gajop',
		repo: 'test',
		channel: defaultChannel,
		platform: defaultPlatform
	});


});

test('bad-match-channel-platform', () => {
	const nonNativePlatform = defaultPlatform === 'linux-amd64' ? 'windows-amd64' : 'linux-amd64';

	expect(() => {
		fillChannelPlatform(
			parse(`gajop/test#${defaultPlatform}`),
			{
				'channels': {
					[defaultChannel]: ['any']
				}
			}
		);
	}).toThrow();

	expect(() => {
		fillChannelPlatform(
			parse(`gajop/test#${defaultPlatform}`),
			{
				'channels': {
					[defaultChannel]: [nonNativePlatform]
				}
			}
		);
	}).toThrow();


	expect(() => {
		fillChannelPlatform(
			parse('gajop/test@main'),
			{
				'channels': {
					test: ['any']
				}
			}
		);
	}).toThrow();
});