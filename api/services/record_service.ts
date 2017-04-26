import { Record } from '../models/record';
import { ConnectionManager } from './connection_manager';
import { ObjectLiteral } from "typeorm/common/ObjectLiteral";
import * as _ from "lodash";
import { ResObject } from "../common/res_object";
import { Message } from "../common/message";
import { Header } from "../models/header";
import { RecordCategory } from "../common/record_category";
import { DtoRecord } from "../interfaces/dto_record";
import { Collection } from "../models/collection";
import { HeaderService } from "./header_service";
import { StringUtil } from "../utils/string_util";

export class RecordService {
    private static _sort: number = 0;

    static fromDto(target: DtoRecord): Record {
        let collection = new Collection();
        collection.id = target.collectionId;

        let record = new Record();
        record.id = target.id;
        record.url = target.url;
        record.pid = target.pid;
        record.body = target.body;
        if (target.headers instanceof Array) {
            record.headers = target.headers.map(o => {
                let header = HeaderService.fromDto(o);
                header.record = record;
                return header;
            });
        }
        record.test = target.test;
        record.sort = target.sort;
        record.method = target.method;
        record.collection = collection;
        record.name = target.name;
        record.category = target.category;
        return record;
    }

    async save(record: Record) {
        if (!record.id) {
            record.id = StringUtil.generateUID();
        }
        const connection = await ConnectionManager.getInstance();
        await connection.getRepository(Record).persist(record);
    }

    static formatHeaders(record: Record): { [key: string]: string } {
        let headers: { [key: string]: string } = {};
        record.headers.forEach(o => {
            if (o.isActive) {
                headers[o.key] = o.value;
            }
        });
        return headers;
    }

    static clone(record: Record): Record {
        const target = <Record>Object.create(record);
        target.id = StringUtil.generateUID();
        target.headers = target.headers.map(h => HeaderService.clone(h));
        target.createDate = new Date();
        return target;
    }

    static async getByCollectionIds(collectionIds: string[], needCollection?: boolean): Promise<{ [key: string]: Record[] }> {
        if (!collectionIds || collectionIds.length === 0) {
            return {};
        }
        const connection = await ConnectionManager.getInstance();

        const parameters: ObjectLiteral = {};
        const whereStrings = collectionIds.map((id, index) => {
            parameters[`id_${index}`] = id;
            return `collection.id=:id_${index}`;
        });
        const whereStr = whereStrings.length > 1 ? "(" + whereStrings.join(" OR ") + ")" : whereStrings[0];

        let records = await connection.getRepository(Record).createQueryBuilder("record")
            .innerJoinAndSelect("record.collection", "collection")
            .leftJoinAndSelect('record.headers', 'header')
            .where(whereStr, parameters)
            .getMany();

        let recordsList = _.groupBy(records, o => o.collection.id);

        for (let key in recordsList) {
            if (!needCollection) {
                recordsList[key].forEach(r => r.collection = undefined);
            }
            recordsList[key] = RecordService.toTree(recordsList[key]);
        }

        return recordsList;
    }

    static async getById(id: string, includeHeaders: boolean = false): Promise<Record> {
        const connection = await ConnectionManager.getInstance();
        let rep = connection.getRepository(Record).createQueryBuilder("record");
        if (includeHeaders) {
            rep = rep.leftJoinAndSelect('record.headers', 'header');
        }
        return await rep.where('record.id=:id', { id: id }).getOne();
    }

    static async create(record: Record): Promise<ResObject> {
        record.sort = await RecordService.getMaxSort();
        return await RecordService.save(record);
    }

    static async update(record: Record): Promise<ResObject> {
        const connection = await ConnectionManager.getInstance();
        const recordInDB = await RecordService.getById(record.id);

        if (recordInDB && recordInDB.headers.length > 0) {
            await connection.getRepository(Header).remove(recordInDB.headers);
        }

        return await RecordService.save(record);
    }

    static async getMaxSort(): Promise<number> {
        const connection = await ConnectionManager.getInstance();
        const maxSortRecord = await connection.getRepository(Record)
            .createQueryBuilder('record')
            .addOrderBy('sort', 'DESC')
            .getOne();
        let maxSort = ++RecordService._sort;
        if (maxSortRecord && maxSortRecord.sort) {
            maxSort = Math.max(maxSort, maxSortRecord.sort + 1);
            RecordService._sort = maxSort;
        }
        return maxSort;
    }

    static async sort(recordId: string, folderId: string, collectionId: string, newSort: number): Promise<ResObject> {
        const connection = await ConnectionManager.getInstance();
        await connection.getRepository(Record).transaction(async rep => {
            await rep.query('update record r set r.sort = r.sort+1 where r.sort >= ? and r.collectionId = ? and pid = ?', [newSort, collectionId, folderId]);
            await rep.createQueryBuilder('record')
                .where('record.id=:id')
                .addParameters({ 'id': recordId })
                .update(Record, { 'collectionId': collectionId, 'pid': folderId, 'sort': newSort })
                .execute();
        });
        return { success: true, message: Message.recordSortSuccess };
    }

    private static async save(record: Record): Promise<ResObject> {
        if (!record.name) {
            return { success: false, message: Message.recordCreateFailedOnName };
        }
        await RecordService.save(record);
        return { success: true, message: Message.recordSaveSuccess };
    }

    private static toTree(records: Record[], parent?: Record, pushedRecord?: Array<string>): Record[] {
        let result = new Array<Record>();
        let nonParentRecord = new Array<Record>();
        pushedRecord = pushedRecord || new Array<string>();
        const pushChild = (r, p) => {
            p.children = p.children || [];
            p.children.push(r);
        };

        records.forEach(r => {
            if (r.category === RecordCategory.folder) {
                if (!r.pid && !parent) {
                    result.push(r);
                    pushedRecord.push(r.id);
                    RecordService.toTree(records, r, pushedRecord);
                }
                else if (parent && r.pid === parent.id) {
                    pushChild(r, parent);
                    pushedRecord.push(r.id);
                    RecordService.toTree(records, r, pushedRecord);
                }
            }
            else if (parent && r.pid === parent.id) {
                pushChild(r, parent);
            }
            else if (!parent && !r.pid) {
                nonParentRecord.push(r);
            }
        });

        result.push(...nonParentRecord);

        return result;
    }
}