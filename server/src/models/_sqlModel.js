import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

const cloneValue = (value) => structuredClone(value);

const toCamel = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const toSnake = (value) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

const normalizeJsonArrayItems = (items = []) => {
  const normalized = Array.isArray(items) ? items : [];

  return normalized.map((item) => {
    if (!isPlainObject(item)) {
      return item;
    }

    return {
      _id: item._id || item.id || crypto.randomUUID(),
      ...item
    };
  });
};

const withCollectionHelpers = (items = []) => {
  const collection = normalizeJsonArrayItems(items);

  Object.defineProperty(collection, 'id', {
    enumerable: false,
    value(itemId) {
      return collection.find((item) => String(item?._id) === String(itemId)) || null;
    }
  });

  Object.defineProperty(collection, 'pull', {
    enumerable: false,
    value(itemId) {
      const index = collection.findIndex((item) => String(item?._id) === String(itemId));
      if (index >= 0) {
        collection.splice(index, 1);
      }
    }
  });

  return collection;
};

const deepMerge = (base, current) => {
  if (Array.isArray(current)) {
    return current;
  }

  if (!isPlainObject(base) || !isPlainObject(current)) {
    return current === undefined ? base : current;
  }

  const result = { ...base };
  Object.entries(current).forEach(([key, value]) => {
    result[key] = deepMerge(base[key], value);
  });

  return result;
};

const getJsonPathSegments = (field) => field.split('.');

const parseSelect = (value = '') => String(value || '')
  .split(/\s+/)
  .map((item) => item.trim())
  .filter(Boolean);

const applySelectToPlainObject = (value, select, hiddenFields = []) => {
  if (!value) {
    return value;
  }

  const include = parseSelect(select).filter((item) => item.startsWith('+')).map((item) => item.slice(1));
  const exclude = parseSelect(select).filter((item) => item.startsWith('-')).map((item) => item.slice(1));

  const result = { ...value };

  hiddenFields.forEach((field) => {
    if (!include.includes(field)) {
      delete result[field];
    }
  });

  exclude.forEach((field) => {
    delete result[field];
  });

  return result;
};

class SqlDocument {
  constructor(model, rawData, { isNew = false, select = null } = {}) {
    this._model = model;
    this._rawData = cloneValue(rawData);
    this._isNew = isNew;

    const visibleData = applySelectToPlainObject(cloneValue(rawData), select, model.hiddenFields);
    Object.assign(this, visibleData);
    this._decorate();
  }

  _decorate() {
    if (this.members) {
      this.members = withCollectionHelpers(this.members);
    }

    if (this.collaboration) {
      this.collaboration = {
        comments: withCollectionHelpers(this.collaboration.comments || []),
        tasks: withCollectionHelpers(this.collaboration.tasks || [])
      };
    }
  }

  _composeData() {
    const current = {};

    Object.keys(this).forEach((key) => {
      if (!key.startsWith('_')) {
        current[key] = this[key];
      }
    });

    return deepMerge(this._rawData, current);
  }

  async save() {
    const saved = await this._model._saveDocument(this);
    this._rawData = cloneValue(saved);

    Object.keys(this).forEach((key) => {
      if (!key.startsWith('_')) {
        delete this[key];
      }
    });

    Object.assign(this, saved);
    this._decorate();
    this._isNew = false;
    return this;
  }

  async deleteOne() {
    await this._model.deleteOne({ _id: this._rawData._id || this._id });
  }

  toObject() {
    const plain = {};

    Object.keys(this).forEach((key) => {
      if (!key.startsWith('_')) {
        plain[key] = cloneValue(this[key]);
      }
    });

    return plain;
  }
}

class SqlQueryBuilder {
  constructor(model, operation, args = {}) {
    this.model = model;
    this.operation = operation;
    this.args = { ...args };
  }

  select(value) {
    this.args.select = value;
    return this;
  }

  sort(value) {
    this.args.sort = value;
    return this;
  }

  skip(value) {
    this.args.skip = value;
    return this;
  }

  limit(value) {
    this.args.limit = value;
    return this;
  }

  lean() {
    this.args.lean = true;
    return this;
  }

  async exec() {
    return this.model._execute(this.operation, this.args);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  finally(handler) {
    return this.exec().finally(handler);
  }
}

export class SqlModel {
  constructor({
    tableName,
    hiddenFields = [],
    jsonFields = [],
    defaultSort = null,
    defaults = {},
    beforeSave = null,
    decorateDocument = null
  }) {
    this.tableName = tableName;
    this.hiddenFields = hiddenFields;
    this.jsonFields = new Set(jsonFields);
    this.defaultSort = defaultSort;
    this.defaults = defaults;
    this.beforeSave = beforeSave;
    this.decorateDocument = decorateDocument;
  }

  _buildDocument(rawData, options = {}) {
    const document = new SqlDocument(this, rawData, options);

    if (this.decorateDocument) {
      this.decorateDocument(document);
    }

    return document;
  }

  _normalizeRecord(record = {}) {
    const normalized = {};

    Object.entries(record).forEach(([key, value]) => {
      normalized[toCamel(key)] = value;
    });

    if (normalized.id && !normalized._id) {
      normalized._id = normalized.id;
    }

    if (!normalized.id && normalized._id) {
      normalized.id = normalized._id;
    }

    return normalized;
  }

  _serializeForWrite(data = {}) {
    const serialized = {};
    const source = { ...this.defaults, ...data };

    Object.entries(source).forEach(([key, value]) => {
      if (key === '_id' || key === 'id') {
        serialized.id = value;
        return;
      }

      const normalizedValue = value === undefined ? null : value;
      serialized[toSnake(key)] = this.jsonFields.has(key) && normalizedValue !== null
        ? JSON.stringify(normalizedValue)
        : normalizedValue;
    });

    return serialized;
  }

  _makeWhereClause(filter = {}, startIndex = 1) {
    const clauses = [];
    const values = [];
    let paramIndex = startIndex;

    const buildFieldExpression = (field) => {
      if (field === '_id' || field === 'id') {
        return { expression: 'id', mode: 'column' };
      }

      if (!field.includes('.')) {
        return { expression: toSnake(field), mode: 'column' };
      }

      const [root, ...segments] = getJsonPathSegments(field);
      const jsonColumn = toSnake(root);

      if (root === 'members') {
        const [jsonField] = segments;
        return { expression: `${jsonColumn}:${jsonField}`, mode: 'json-array' };
      }

      return {
        expression: `${jsonColumn} #>> '{${segments.join(',')}}'`,
        mode: 'json-object'
      };
    };

    const appendCondition = (field, condition) => {
      const descriptor = buildFieldExpression(field);

      if (isPlainObject(condition) && ('$regex' in condition)) {
        clauses.push(`${descriptor.expression} ILIKE $${paramIndex}`);
        values.push(`%${condition.$regex}%`);
        paramIndex += 1;
        return;
      }

      if (isPlainObject(condition) && !Array.isArray(condition)) {
        Object.entries(condition).forEach(([operator, rawValue]) => {
          if (operator === '$options') {
            return;
          }

          if (descriptor.mode === 'json-array') {
            const [jsonColumn, jsonField] = descriptor.expression.split(':');
            clauses.push(
              `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(${jsonColumn}, '[]'::jsonb)) AS elem WHERE elem->>'${jsonField}' = $${paramIndex})`
            );
            values.push(String(rawValue));
            paramIndex += 1;
            return;
          }

          const operatorMap = {
            $gte: '>=',
            $lte: '<=',
            $lt: '<',
            $gt: '>'
          };

          if (operatorMap[operator]) {
            clauses.push(`${descriptor.expression} ${operatorMap[operator]} $${paramIndex}`);
            values.push(rawValue);
            paramIndex += 1;
          }
        });
        return;
      }

      if (descriptor.mode === 'json-array') {
        const [jsonColumn, jsonField] = descriptor.expression.split(':');
        clauses.push(
          `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(${jsonColumn}, '[]'::jsonb)) AS elem WHERE elem->>'${jsonField}' = $${paramIndex})`
        );
        values.push(String(condition));
        paramIndex += 1;
        return;
      }

      clauses.push(`${descriptor.expression} = $${paramIndex}`);
      values.push(condition);
      paramIndex += 1;
    };

    Object.entries(filter || {}).forEach(([field, value]) => {
      if (field === '$or' && Array.isArray(value)) {
        const orClauses = [];

        value.forEach((entry) => {
          const nested = this._makeWhereClause(entry, paramIndex);

          if (nested.text) {
            orClauses.push(`(${nested.text.replace(/^WHERE\s+/i, '')})`);
            values.push(...nested.values);
            paramIndex += nested.values.length;
          }
        });

        if (orClauses.length) {
          clauses.push(orClauses.join(' OR '));
        }
        return;
      }

      appendCondition(field, value);
    });

    return {
      text: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
      values
    };
  }

  _makeSortClause(sort = null) {
    const activeSort = sort || this.defaultSort;

    if (!activeSort || !isPlainObject(activeSort)) {
      return '';
    }

    const parts = Object.entries(activeSort).map(([field, direction]) => {
      const column = field === '_id' ? 'id' : toSnake(field);
      return `${column} ${Number(direction) < 0 ? 'DESC' : 'ASC'}`;
    });

    return parts.length ? `ORDER BY ${parts.join(', ')}` : '';
  }

  _rowToResult(row, { lean = false, select = null } = {}) {
    if (!row) {
      return null;
    }

    const normalized = this._normalizeRecord(row);

    if (lean) {
      return applySelectToPlainObject(normalized, select, this.hiddenFields);
    }

    return this._buildDocument(normalized, { select });
  }

  find(filter = {}, projection = null) {
    return new SqlQueryBuilder(this, 'find', { filter, projection });
  }

  findOne(filter = {}) {
    return new SqlQueryBuilder(this, 'findOne', { filter });
  }

  findById(id) {
    return new SqlQueryBuilder(this, 'findById', { id });
  }

  async findByIdAndUpdate(id, updates = {}) {
    const existing = await this.findById(id);

    if (!existing) {
      return null;
    }

    Object.assign(existing, updates);
    await existing.save();
    return existing;
  }

  async create(data = {}) {
    const timestamp = new Date();
    const normalized = {
      _id: data._id || data.id || crypto.randomUUID(),
      createdAt: data.createdAt || timestamp,
      updatedAt: data.updatedAt || timestamp,
      ...cloneValue(data)
    };

    const prepared = this.beforeSave ? await this.beforeSave(normalized, { isNew: true }) : normalized;
    const serialized = this._serializeForWrite(prepared);
    const columns = Object.keys(serialized);
    const values = Object.values(serialized);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    const sql = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    const result = await query(sql, values);
    return this._rowToResult(result.rows[0]);
  }

  async deleteOne(filter = {}) {
    const where = this._makeWhereClause(filter);
    await query(`DELETE FROM ${this.tableName} ${where.text}`, where.values);
  }

  async countDocuments(filter = {}) {
    const where = this._makeWhereClause(filter);
    const result = await query(`SELECT COUNT(*)::int AS count FROM ${this.tableName} ${where.text}`, where.values);
    return result.rows[0]?.count || 0;
  }

  async updateMany(filter = {}, update = {}) {
    const where = this._makeWhereClause(filter);
    const setEntries = Object.entries(update.$set || {});
    const values = [...where.values];

    if (!setEntries.length) {
      return;
    }

    const assignments = setEntries.map(([field, value], index) => {
      const paramIndex = values.length + index + 1;

      if (field.includes('.')) {
        const [root, ...segments] = field.split('.');
        const column = toSnake(root);
        return `${column} = jsonb_set(COALESCE(${column}, '{}'::jsonb), '{${segments.join(',')}}', $${paramIndex}::jsonb, true)`;
      }

      return `${toSnake(field)} = $${paramIndex}`;
    });

    setEntries.forEach(([field, value]) => {
      values.push(field.includes('.') ? JSON.stringify(value) : value);
    });

    await query(`
      UPDATE ${this.tableName}
      SET ${assignments.join(', ')}, updated_at = NOW()
      ${where.text}
    `, values);
  }

  async _saveDocument(document) {
    const timestamp = new Date();
    const composed = {
      ...document._composeData(),
      updatedAt: timestamp
    };

    if (document._isNew && !composed.createdAt) {
      composed.createdAt = timestamp;
    }

    const prepared = this.beforeSave ? await this.beforeSave(composed, { isNew: document._isNew }) : composed;
    const serialized = this._serializeForWrite(prepared);
    const entries = Object.entries(serialized).filter(([key]) => key !== 'id');
    const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
    const values = entries.map(([, value]) => value);
    values.push(prepared._id || prepared.id);

    const result = await query(`
      UPDATE ${this.tableName}
      SET ${assignments.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `, values);

    return this._normalizeRecord(result.rows[0]);
  }

  async _execute(operation, args = {}) {
    if (operation === 'findById') {
      const result = await this._execute('findOne', {
        filter: { _id: args.id },
        select: args.select,
        lean: args.lean
      });
      return result;
    }

    if (operation === 'findOne') {
      const where = this._makeWhereClause(args.filter || {});
      const sortClause = this._makeSortClause(args.sort);
      const sql = `
        SELECT *
        FROM ${this.tableName}
        ${where.text}
        ${sortClause}
        LIMIT 1
      `;
      const result = await query(sql, where.values);
      return this._rowToResult(result.rows[0], args);
    }

    if (operation === 'find') {
      const where = this._makeWhereClause(args.filter || {});
      const sortClause = this._makeSortClause(args.sort);
      const values = [...where.values];
      let paginationClause = '';

      if (args.limit !== undefined) {
        values.push(args.limit);
        paginationClause += ` LIMIT $${values.length}`;
      }

      if (args.skip !== undefined) {
        values.push(args.skip);
        paginationClause += ` OFFSET $${values.length}`;
      }

      const sql = `
        SELECT *
        FROM ${this.tableName}
        ${where.text}
        ${sortClause}
        ${paginationClause}
      `;
      const result = await query(sql, values);
      return result.rows.map((row) => this._rowToResult(row, args));
    }

    return null;
  }
}

export const createPasswordModelHooks = () => async (data) => {
  const prepared = { ...data };

  if (prepared.password && !String(prepared.password).startsWith('$2')) {
    prepared.password = await bcrypt.hash(prepared.password, 12);
  }

  return prepared;
};

export const attachPasswordMethods = (document) => {
  Object.defineProperty(document, 'comparePassword', {
    enumerable: false,
    value: async function comparePassword(candidatePassword) {
      return bcrypt.compare(candidatePassword, this.password);
    }
  });
};
