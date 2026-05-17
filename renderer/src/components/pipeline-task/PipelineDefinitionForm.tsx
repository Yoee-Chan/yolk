import React, {useEffect} from 'react';
import {
    Button,
    Checkbox,
    DatePicker,
    Form,
    Input,
    Modal,
    Select,
    Space,
    Steps,
    TimePicker,
    Typography,
} from 'antd';
import {DeleteOutlined, PlusOutlined} from '@ant-design/icons';
import dayjs, {type Dayjs} from 'dayjs';
import type {PipelineDefinition, ProcessStage, ScheduleType} from './types';
import {PERMISSION_OPTIONS} from './types';
import {newId, scheduleTypeLabel} from './utils';

const {TextArea} = Input;
const {Text} = Typography;

export type DefinitionFormValues = {
    name: string;
    description: string;
    scheduleType: ScheduleType;
    scheduleTime?: Dayjs;
    scheduleDatetime?: Dayjs;
    weekdays?: number[];
    stages: {
        name: string;
        description?: string;
        permissions: string[];
    }[];
};

interface Props {
    open: boolean;
    editing: PipelineDefinition | null;
    onCancel: () => void;
    onSubmit: (values: DefinitionFormValues) => void;
}

const WEEKDAY_OPTIONS = [
    {value: 1, label: '\u5468\u4e00'},
    {value: 2, label: '\u5468\u4e8c'},
    {value: 3, label: '\u5468\u4e09'},
    {value: 4, label: '\u5468\u56db'},
    {value: 5, label: '\u5468\u4e94'},
    {value: 6, label: '\u5468\u516d'},
    {value: 0, label: '\u5468\u65e5'},
];

function toFormValues(def: PipelineDefinition | null): DefinitionFormValues {
    if (!def) {
        return {
            name: '',
            description: '',
            scheduleType: 'daily',
            scheduleTime: dayjs('08:00', 'HH:mm'),
            stages: [{name: '', description: '', permissions: []}],
        };
    }
    return {
        name: def.name,
        description: def.description,
        scheduleType: def.schedule.type,
        scheduleTime: def.schedule.time ? dayjs(def.schedule.time, 'HH:mm') : undefined,
        scheduleDatetime: def.schedule.datetime ? dayjs(def.schedule.datetime) : undefined,
        weekdays: def.schedule.weekdays,
        stages: def.stages.map((s) => ({
            name: s.name,
            description: s.description,
            permissions: [...s.permissions],
        })),
    };
}

export default function PipelineDefinitionForm({open, editing, onCancel, onSubmit}: Props) {
    const [form] = Form.useForm<DefinitionFormValues>();
    const [step, setStep] = React.useState(0);
    const scheduleType = Form.useWatch('scheduleType', form);

    useEffect(() => {
        if (open) {
            form.setFieldsValue(toFormValues(editing));
            setStep(0);
        }
    }, [open, editing, form]);

    const handleOk = async () => {
        if (step < 2) {
            try {
                const fields =
                    step === 0
                        ? ['name', 'scheduleType', 'scheduleTime', 'scheduleDatetime', 'weekdays']
                        : ['stages'];
                await form.validateFields(fields as (keyof DefinitionFormValues)[]);
                setStep(step + 1);
            } catch {
                /* validation shown */
            }
            return;
        }
        try {
            const values = await form.validateFields();
            onSubmit(values);
        } catch {
            /* validation shown */
        }
    };

    const title = editing
        ? `\u7f16\u8f91\u6d41\u6c34\u7ebf\u00b7${editing.name}`
        : '\u65b0\u5efa\u6d41\u6c34\u7ebf\u4efb\u52a1';

    return (
        <Modal
            open={open}
            title={title}
            onCancel={onCancel}
            width={640}
            destroyOnHidden
            footer={
                <Space>
                    <Button onClick={onCancel}>{'\u53d6\u6d88'}</Button>
                    {step > 0 && (
                        <Button onClick={() => setStep(step - 1)}>{'\u4e0a\u4e00\u6b65'}</Button>
                    )}
                    <Button type="primary" onClick={handleOk}>
                        {step < 2 ? '\u4e0b\u4e00\u6b65' : editing ? '\u4fdd\u5b58' : '\u521b\u5efa'}
                    </Button>
                </Space>
            }
        >
            <Steps
                current={step}
                size="small"
                style={{marginBottom: 20}}
                items={[
                    {title: '\u5f00\u59cb', content: '\u8bbe\u7f6e\u65f6\u95f4'},
                    {title: '\u8fc7\u7a0b', content: '\u9636\u6bb5\u4e0e\u6743\u9650'},
                    {title: '\u786e\u8ba4', content: '\u9884\u89c8\u914d\u7f6e'},
                ]}
            />

            <p className="pipeline-phase-hint">
                <strong>{'\u9636\u6bb5\u8bf4\u660e\uff1a'}</strong>
                {'\u5f00\u59cb\u8bbe\u5b9a\u6267\u884c\u65f6\u95f4 \u2192 \u8fc7\u7a0b\u53ef\u589e\u52a0\u591a\u4e2a\u9636\u6bb5\u5e76\u914d\u7f6e\u6743\u9650 \u2192 \u6267\u884c\u7ed3\u679c\u4e3a\u5b8c\u6210\u3001\u9519\u8bef\u6216\u5df2\u5f03\u7528'}
            </p>

            <Form form={form} layout="vertical" preserve={false}>
                {step === 0 && (
                    <>
                        <p className="form-section-title">{'\u57fa\u672c\u4fe1\u606f'}</p>
                        <Form.Item
                            name="name"
                            label={'\u4efb\u52a1\u540d\u79f0'}
                            rules={[{required: true, message: '\u8bf7\u8f93\u5165\u540d\u79f0'}]}
                        >
                            <Input placeholder={'\u4f8b\uff1aHSBC \u4ea4\u6613\u62a5\u8868\u62c9\u53d6'}/>
                        </Form.Item>
                        <Form.Item name="description" label={'\u63cf\u8ff0'}>
                            <TextArea rows={2} placeholder={'\u7b80\u8981\u8bf4\u660e\u8be5\u6d41\u6c34\u7ebf\u505a\u4ec0\u4e48'}/>
                        </Form.Item>

                        <p className="form-section-title">{'\u5f00\u59cb \u00b7 \u6267\u884c\u65f6\u95f4'}</p>
                        <Form.Item
                            name="scheduleType"
                            label={'\u8c03\u5ea6\u7c7b\u578b'}
                            rules={[{required: true}]}
                        >
                            <Select
                                options={(
                                    ['once', 'daily', 'weekly'] as ScheduleType[]
                                ).map((t) => ({value: t, label: scheduleTypeLabel(t)}))}
                            />
                        </Form.Item>

                        {scheduleType === 'once' && (
                            <Form.Item
                                name="scheduleDatetime"
                                label={'\u6267\u884c\u65e5\u671f\u4e0e\u65f6\u95f4'}
                                rules={[{required: true, message: '\u8bf7\u9009\u62e9\u65f6\u95f4'}]}
                            >
                                <DatePicker showTime style={{width: '100%'}}/>
                            </Form.Item>
                        )}

                        {(scheduleType === 'daily' || scheduleType === 'weekly') && (
                            <Form.Item
                                name="scheduleTime"
                                label={'\u6bcf\u65e5\u6267\u884c\u65f6\u95f4'}
                                rules={[{required: true, message: '\u8bf7\u9009\u62e9\u65f6\u95f4'}]}
                            >
                                <TimePicker format="HH:mm" style={{width: '100%'}}/>
                            </Form.Item>
                        )}

                        {scheduleType === 'weekly' && (
                            <Form.Item
                                name="weekdays"
                                label={'\u6267\u884c\u661f\u671f'}
                                rules={[
                                    {
                                        required: true,
                                        type: 'array',
                                        min: 1,
                                        message: '\u81f3\u5c11\u9009\u62e9\u4e00\u5929',
                                    },
                                ]}
                            >
                                <Checkbox.Group options={WEEKDAY_OPTIONS}/>
                            </Form.Item>
                        )}
                    </>
                )}

                {step === 1 && (
                    <>
                        <p className="form-section-title">{'\u8fc7\u7a0b \u00b7 \u9636\u6bb5\u4e0e\u6743\u9650'}</p>
                        <Form.List
                            name="stages"
                            rules={[
                                {
                                    validator: async (_, stages) => {
                                        if (!stages || stages.length < 1) {
                                            throw new Error('\u81f3\u5c11\u6dfb\u52a0\u4e00\u4e2a\u9636\u6bb5');
                                        }
                                    },
                                },
                            ]}
                        >
                            {(fields, {add, remove}) => (
                                <>
                                    {fields.map((field, index) => (
                                        <section key={field.key} className="stage-editor-row">
                                            <header className="stage-editor-row__head">
                                                <span className="stage-editor-row__index">
                                                    {'\u9636\u6bb5 '}{index + 1}
                                                </span>
                                                {fields.length > 1 && (
                                                    <Button
                                                        type="text"
                                                        danger
                                                        size="small"
                                                        icon={<DeleteOutlined/>}
                                                        onClick={() => remove(field.name)}
                                                    >
                                                        {'\u5220\u9664'}
                                                    </Button>
                                                )}
                                            </header>
                                            <Form.Item
                                                {...field}
                                                name={[field.name, 'name']}
                                                label={'\u9636\u6bb5\u540d\u79f0'}
                                                rules={[{required: true, message: '\u8bf7\u8f93\u5165\u9636\u6bb5\u540d'}]}
                                            >
                                                <Input placeholder={'\u4f8b\uff1a\u6253\u5f00\u90ae\u7bb1'}/>
                                            </Form.Item>
                                            <Form.Item
                                                {...field}
                                                name={[field.name, 'description']}
                                                label={'\u8bf4\u660e'}
                                            >
                                                <Input placeholder={'\u53ef\u9009'}/>
                                            </Form.Item>
                                            <Form.Item
                                                {...field}
                                                name={[field.name, 'permissions']}
                                                label={'\u6743\u9650\u914d\u7f6e'}
                                            >
                                                <Select
                                                    mode="multiple"
                                                    allowClear
                                                    placeholder={'\u9009\u62e9\u8be5\u9636\u6bb5\u6240\u9700\u6743\u9650'}
                                                    options={PERMISSION_OPTIONS.map((p) => ({
                                                        value: p.value,
                                                        label: p.label,
                                                    }))}
                                                />
                                            </Form.Item>
                                        </section>
                                    ))}
                                    <Button
                                        type="dashed"
                                        block
                                        icon={<PlusOutlined/>}
                                        onClick={() => add({name: '', description: '', permissions: []})}
                                    >
                                        {'\u6dfb\u52a0\u9636\u6bb5'}
                                    </Button>
                                </>
                            )}
                        </Form.List>
                    </>
                )}

                {step === 2 && (
                    <Form.Item shouldUpdate noStyle>
                        {() => {
                            const v = form.getFieldsValue();
                            return (
                                <section>
                                    <p className="form-section-title">{'\u786e\u8ba4\u914d\u7f6e'}</p>
                                    <p>
                                        <Text strong>{v.name}</Text>
                                    </p>
                                    {v.description && (
                                        <p>
                                            <Text type="secondary">{v.description}</Text>
                                        </p>
                                    )}
                                    <p style={{marginTop: 12}}>
                                        <TagLike color="blue">
                                            {'\u5f00\u59cb \u00b7 '}
                                            {scheduleTypeLabel(v.scheduleType)}
                                            {v.scheduleTime && ` \u00b7 ${v.scheduleTime.format('HH:mm')}`}
                                            {v.scheduleDatetime &&
                                                ` \u00b7 ${v.scheduleDatetime.format('YYYY-MM-DD HH:mm')}`}
                                        </TagLike>
                                    </p>
                                    <ol style={{marginTop: 16, paddingLeft: 20}}>
                                        {(v.stages ?? []).map((s, i) => (
                                            <li key={i} style={{marginBottom: 12}}>
                                                <Text strong>
                                                    {i + 1}. {s.name}
                                                </Text>
                                                {s.description && (
                                                    <p style={{margin: '4px 0', color: '#8c8c8c'}}>
                                                        {s.description}
                                                    </p>
                                                )}
                                                {(s.permissions ?? []).length > 0 && (
                                                    <span className="permission-tags">
                                                        {s.permissions.map((p) => (
                                                            <TagLike key={p}>{p}</TagLike>
                                                        ))}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ol>
                                    <Text type="secondary" style={{fontSize: 12}}>
                                        {
                                            '\u6267\u884c\u540e\u7ed3\u679c\u5c06\u6807\u8bb0\u4e3a\u5b8c\u6210\u3001\u9519\u8bef\u6216\u5df2\u5f03\u7528\uff08\u8fdb\u884c\u4e2d\u53ef\u624b\u52a8\u53d6\u6d88\uff09'
                                        }
                                    </Text>
                                </section>
                            );
                        }}
                    </Form.Item>
                )}
            </Form>
        </Modal>
    );
}

function TagLike({children, color}: {children: React.ReactNode; color?: string}) {
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
                background: color === 'blue' ? '#e6f4ff' : '#f5f5f5',
                color: color === 'blue' ? '#1677ff' : '#595959',
                marginRight: 6,
            }}
        >
            {children}
        </span>
    );
}

export function buildDefinitionFromForm(
    values: DefinitionFormValues,
    existing?: PipelineDefinition,
): PipelineDefinition {
    const stages: ProcessStage[] = values.stages.map((s) => ({
        id: newId('stage'),
        name: s.name,
        description: s.description,
        permissions: s.permissions ?? [],
    }));

    return {
        id: existing?.id ?? newId('def'),
        name: values.name,
        description: values.description ?? '',
        enabled: existing?.enabled ?? true,
        schedule: {
            type: values.scheduleType,
            time:
                values.scheduleType !== 'once' && values.scheduleTime
                    ? values.scheduleTime.format('HH:mm')
                    : undefined,
            datetime:
                values.scheduleType === 'once' && values.scheduleDatetime
                    ? values.scheduleDatetime.toISOString()
                    : undefined,
            weekdays: values.scheduleType === 'weekly' ? values.weekdays : undefined,
        },
        stages,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
}
