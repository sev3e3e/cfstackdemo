import type { IResource, ResourceAttributes } from './interfaces';

/**
 * A Resource describes the entity for which a signals (metrics or trace) are
 * collected.
 */
export class Resource implements IResource {
	static readonly EMPTY: Resource = new Resource({});

	private _syncAttributes?: ResourceAttributes;
	private _asyncAttributesPromise?: Promise<ResourceAttributes>;
	private _attributes?: ResourceAttributes;

	/**
	 * Check if async attributes have resolved. This is useful to avoid awaiting
	 * waitForAsyncAttributes (which will introduce asynchronous behavior) when not necessary.
	 *
	 * @returns true if the resource "attributes" property is not yet settled to its final value
	 */
	asyncAttributesPending?: boolean;

	/**
	 * Returns an empty Resource
	 */
	static empty(): IResource {
		return Resource.EMPTY;
	}

	/**
	 * Returns a Resource that identifies the SDK in use.
	 */
	static default(): IResource {
		return new Resource({});
	}

	constructor(
		/**
		 * A dictionary of attributes with string keys and values that provide
		 * information about the entity as numbers, strings or booleans
		 * TODO: Consider to add check/validation on attributes.
		 */
		attributes: ResourceAttributes,
		asyncAttributesPromise?: Promise<ResourceAttributes>
	) {
		this._syncAttributes = { ...attributes };
		this._asyncAttributesPromise = asyncAttributesPromise;
		this.asyncAttributesPending = !!asyncAttributesPromise;
	}

	get attributes(): ResourceAttributes {
		if (this._attributes) {
			return this._attributes;
		}

		// 非同期属性がまだ解決されていない場合は同期属性のみ返す
		if (this.asyncAttributesPending) {
			return { ...this._syncAttributes };
		}

		return { ...this._syncAttributes };
	}

	/**
	 * Returns a promise that will never be rejected. Resolves when all async attributes have finished being added to
	 * this Resource's attributes. This is useful in exporters to block until resource detection
	 * has finished.
	 */
	async waitForAsyncAttributes?(): Promise<void> {
		if (!this._asyncAttributesPromise || !this.asyncAttributesPending) {
			return;
		}

		try {
			const asyncAttributes = await this._asyncAttributesPromise;
			this._attributes = {
				...this._syncAttributes,
				...asyncAttributes,
			};
			this.asyncAttributesPending = false;
		} catch (error) {
			// 非同期属性の取得に失敗した場合は同期属性のみ使用
			this._attributes = { ...this._syncAttributes };
			this.asyncAttributesPending = false;
		}
	}

	/**
	 * Returns a new, merged {@link Resource} by merging the current Resource
	 * with the other Resource. In case of a collision, other Resource takes
	 * precedence.
	 *
	 * @param other the Resource that will be merged with this.
	 * @returns the newly merged Resource.
	 */
	merge(other: IResource | null): IResource {
		// nullチェック：otherがnullの場合は現在のResourceをそのまま返す
		if (!other) {
			return this;
		}

		// 同期属性をマージ（otherが優先）
		const mergedSyncAttributes: ResourceAttributes = {
			...this._syncAttributes,
			...other.attributes, // otherの属性で上書き
		};

		// 非同期属性のマージを処理
		let mergedAsyncAttributesPromise: Promise<ResourceAttributes> | undefined;

		// どちらかのResourceが非同期属性を持つ場合
		if (this._asyncAttributesPromise || other.asyncAttributesPending) {
			mergedAsyncAttributesPromise = this._mergeAsyncAttributes(other);
		}

		// 新しいResourceインスタンスを作成
		return new Resource(mergedSyncAttributes, mergedAsyncAttributesPromise);
	}

	/**
	 * 非同期属性をマージするプライベートヘルパーメソッド
	 */
	private async _mergeAsyncAttributes(other: IResource): Promise<ResourceAttributes> {
		const promises: Promise<ResourceAttributes>[] = [];

		// 現在のResourceの非同期属性
		if (this._asyncAttributesPromise) {
			promises.push(this._asyncAttributesPromise);
		}

		// otherのResourceの非同期属性
		if (other.waitForAsyncAttributes) {
			promises.push(other.waitForAsyncAttributes().then(() => other.attributes));
		}

		// 全ての非同期属性を解決
		const resolvedAttributesList = await Promise.all(promises);

		// マージ（後ろの要素が優先）
		const mergedAsyncAttributes: ResourceAttributes = {};
		for (const attrs of resolvedAttributesList) {
			Object.assign(mergedAsyncAttributes, attrs);
		}

		return mergedAsyncAttributes;
	}
}
