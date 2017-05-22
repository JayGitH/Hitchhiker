import React from 'react';
import { SortableContainer, SortableElement, SortableHandle, arrayMove } from 'react-sortable-hoc';
import { Input, Checkbox, Icon } from 'antd';
import './style/index.less';
import { StringUtil } from '../../utils/string_util';
import { DtoHeader } from '../../../../api/interfaces/dto_header';

const generateDefaultHeader: () => DtoHeader = () => ({

    id: StringUtil.generateUID(),

    isActive: true
});

interface KeyValueComponentProps {

    headers: Array<DtoHeader>;

    onChanged: (headers: DtoHeader[]) => void;
}

interface KeyValueComponentState {

    headers: Array<DtoHeader>;
}

interface SortableElementParam {

    header: DtoHeader;

    hIndex: number;
}

class KeyValueComponent extends React.Component<KeyValueComponentProps, KeyValueComponentState> {

    private DragHandle = SortableHandle(() => <span className="keyvalue-dragicon">☰</span>);

    private SortableItem = SortableElement(({ hIndex, header }: SortableElementParam) => {
        const visibility = { visibility: (hIndex === this.state.headers.length - 1 ? 'hidden' : 'visible') };
        return (
            <li className="keyvalue-item">
                <div style={visibility}>
                    <this.DragHandle />
                    <Checkbox
                        key={`cb${header.id}`}
                        onChange={(e) => this.onValueChange('isActive', hIndex, e)}
                        defaultChecked={header.isActive}
                    />
                </div>
                <Input
                    spellCheck={false}
                    key={`key${header.id}`}
                    onChange={(e) => this.onValueChange('key', hIndex, e)}
                    placeholder="key"
                    value={header.key}
                />
                <Input
                    spellCheck={false}
                    key={`value${header.id}`}
                    onChange={(e) => this.onValueChange('value', hIndex, e)}
                    placeholder="value"
                    value={header.value}
                />
                <Icon style={visibility} type="close" onClick={(event) => this.onDelItem(hIndex)} />
            </li>
        );
    });

    private SortableList = SortableContainer(({ headers }) => {
        return (
            <ul>
                {
                    headers.map((header, index) => (
                        <this.SortableItem
                            key={`item_${index}`}
                            index={index}
                            hIndex={index}
                            header={header}
                            disabled={index === this.state.headers.length - 1}
                        />)
                    )
                }
            </ul>
        );
    });

    constructor(props: KeyValueComponentProps) {
        super(props);
        this.state = { headers: [generateDefaultHeader()] };
    }

    componentWillMount() {
        this.appendIfNeed(this.props);
    }

    componentWillReceiveProps(nextProps: KeyValueComponentProps) {
        this.appendIfNeed(nextProps);
    }

    private getInitialHeaders(props: KeyValueComponentProps): DtoHeader[] {
        let headers = [...props.headers];
        if (!headers || headers.length === 0) {
            headers = [generateDefaultHeader()];
        }
        return headers;
    }

    private appendIfNeed = (props: KeyValueComponentProps) => {
        const headers = this.getInitialHeaders(props);
        const lastHeader = headers[headers.length - 1];
        if (lastHeader.key || lastHeader.value) {
            headers.push(generateDefaultHeader());
        }
        this.setState({ ...this.state, headers: headers });
    }

    private onSortEnd = ({ oldIndex, newIndex }) => {
        let { headers } = this.state;
        headers = arrayMove(headers, oldIndex, newIndex);
        this.onChanged(headers);
    }

    private onValueChange = (type: 'key' | 'value' | 'isActive', index: number, event) => {
        const { headers } = this.state;
        headers[index][type] = event.target.value;
        this.onChanged(headers);
    }

    private onDelItem = (index: number) => {
        const { headers } = this.state;
        headers.splice(index, 1);
        this.onChanged(headers);
    }

    private onChanged(headers: DtoHeader[]) {
        const { onChanged } = this.props;
        if (onChanged) {
            onChanged(headers);
        }
    }

    public render() {
        const headers = this.state.headers;
        return (
            <this.SortableList headers={headers} onSortEnd={this.onSortEnd} useDragHandle={true} />
        );
    }
}

export default KeyValueComponent;