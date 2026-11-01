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
    message,
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
    {value: 1, label: '周一'},
    {value: 2, label: '周二'},
    {value: 3, label: '周三'},
    {value: 4, label: '周四'},
    {value: 5, label: '周五'},
    {value: 6, label: '周六'},
    {value: 0, label: '周日'},
];

/** `HH:mm` → 当天的 dayjs；没有注册 customParseFormat 插件，直接 dayjs('08:00') 会得到 Invalid Date。 */
function parseHHmm(value?: string): Dayjs | undefined {
    if (!value) return undefined;
    const [hour, minute] = value.split(':').map((part) => Number.parseInt(part, 10));
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return undefined;
    return dayjs().hour(hour).minute(minute).second(0).millisecond(0);
}

function toFormValues(def: PipelineDefinition | null): DefinitionFormValues {
    if (!def) {
        return {
            name: '',
            description: '',
            scheduleType: 'daily',
            scheduleTime: parseHHmm('08:00'),
            stages: [{name: '', description: '', permissions: []}],
        };
    }
    return {
        name: def.name,
        description: def.description,
        scheduleType: def.schedule.type,
        scheduleTime: parseHHmm(def.schedule.time),
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
            form.resetFields();
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
            const stages = (values.stages ?? []).filter((s) => (s?.name ?? '').trim() !== '');
            if (stages.length === 0) {
                message.error('至少需要配置一个阶段');
                setStep(1);
                return;
            }
            onSubmit({...values, stages});
        } catch {
            /* validation shown */
        }
    };

    const title = editing
        ? `编辑流水线·${editing.name}`
        : '新建流水线任务';

    return (
        <Modal
            open={open}
            title={title}
            onCancel={onCancel}
            width={640}
            destroyOnHidden
            footer={
                <Space>
                    <Button onClick={onCancel}>{'取消'}</Button>
                    {step > 0 && (
                        <Button onClick={() => setStep(step - 1)}>{'上一步'}</Button>
                    )}
                    <Button type="primary" onClick={handleOk}>
                        {step < 2 ? '下一步' : editing ? '保存' : '创建'}
                    </Button>
                </Space>
            }
        >
            <Steps
                current={step}
                size="small"
                style={{marginBottom: 20}}
                items={[
                    {title: '开始', content: '设置时间'},
                    {title: '过程', content: '阶段与权限'},
                    {title: '确认', content: '预览配置'},
                ]}
            />

            <p className="pipeline-phase-hint">
                <strong>{'阶段说明：'}</strong>
                {'开始设定执行时间 → 过程可增加多个阶段并配置权限 → 执行结果为完成、错误或已弃用'}
            </p>

            <Form form={form} layout="vertical">
                {/* 三个步骤都保持挂载，仅切换显示：否则在确认步骤提交时字段已卸载，
                    取值会变成空对象，导致「创建」按钮点了没有任何反应。 */}
                <section style={{display: step === 0 ? undefined : 'none'}}>
                        <p className="form-section-title">{'基本信息'}</p>
                        <Form.Item
                            name="name"
                            label={'任务名称'}
                            rules={[{required: true, message: '请输入名称'}]}
                        >
                            <Input placeholder={'例：HSBC 交易报表拉取'}/>
                        </Form.Item>
                        <Form.Item name="description" label={'描述'}>
                            <TextArea rows={2} placeholder={'简要说明该流水线做什么'}/>
                        </Form.Item>

                        <p className="form-section-title">{'开始 · 执行时间'}</p>
                        <Form.Item
                            name="scheduleType"
                            label={'调度类型'}
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
                                label={'执行日期与时间'}
                                rules={[{required: true, message: '请选择时间'}]}
                            >
                                <DatePicker showTime style={{width: '100%'}}/>
                            </Form.Item>
                        )}

                        {(scheduleType === 'daily' || scheduleType === 'weekly') && (
                            <Form.Item
                                name="scheduleTime"
                                label={'每日执行时间'}
                                rules={[{required: true, message: '请选择时间'}]}
                            >
                                <TimePicker format="HH:mm" style={{width: '100%'}}/>
                            </Form.Item>
                        )}

                        {scheduleType === 'weekly' && (
                            <Form.Item
                                name="weekdays"
                                label={'执行星期'}
                                rules={[
                                    {
                                        required: true,
                                        type: 'array',
                                        min: 1,
                                        message: '至少选择一天',
                                    },
                                ]}
                            >
                                <Checkbox.Group options={WEEKDAY_OPTIONS}/>
                            </Form.Item>
                        )}
                </section>

                <section style={{display: step === 1 ? undefined : 'none'}}>
                        <p className="form-section-title">{'过程 · 阶段与权限'}</p>
                        <Form.List
                            name="stages"
                            rules={[
                                {
                                    validator: async (_, stages) => {
                                        if (!stages || stages.length < 1) {
                                            throw new Error('至少添加一个阶段');
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
                                                    {'阶段 '}{index + 1}
                                                </span>
                                                {fields.length > 1 && (
                                                    <Button
                                                        type="text"
                                                        danger
                                                        size="small"
                                                        icon={<DeleteOutlined/>}
                                                        onClick={() => remove(field.name)}
                                                    >
                                                        {'删除'}
                                                    </Button>
                                                )}
                                            </header>
                                            <Form.Item
                                                {...field}
                                                name={[field.name, 'name']}
                                                label={'阶段名称'}
                                                rules={[{required: true, message: '请输入阶段名'}]}
                                            >
                                                <Input placeholder={'例：打开邮箱'}/>
                                            </Form.Item>
                                            <Form.Item
                                                {...field}
                                                name={[field.name, 'description']}
                                                label={'说明'}
                                            >
                                                <Input placeholder={'可选'}/>
                                            </Form.Item>
                                            <Form.Item
                                                {...field}
                                                name={[field.name, 'permissions']}
                                                label={'权限配置'}
                                            >
                                                <Select
                                                    mode="multiple"
                                                    allowClear
                                                    placeholder={'选择该阶段所需权限'}
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
                                        {'添加阶段'}
                                    </Button>
                                </>
                            )}
                        </Form.List>
                </section>

                <section style={{display: step === 2 ? undefined : 'none'}}>
                    <Form.Item shouldUpdate noStyle>
                        {() => {
                            const v = form.getFieldsValue();
                            return (
                                <section>
                                    <p className="form-section-title">{'确认配置'}</p>
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
                                            {'开始 · '}
                                            {scheduleTypeLabel(v.scheduleType)}
                                            {v.scheduleTime?.isValid() &&
                                                ` · ${v.scheduleTime.format('HH:mm')}`}
                                            {v.scheduleDatetime?.isValid() &&
                                                ` · ${v.scheduleDatetime.format('YYYY-MM-DD HH:mm')}`}
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
                                            '执行后结果将标记为完成、错误或已弃用（进行中可手动取消）'
                                        }
                                    </Text>
                                </section>
                            );
                        }}
                    </Form.Item>
                </section>
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
    const stages: ProcessStage[] = (values.stages ?? [])
        .filter((s) => (s?.name ?? '').trim() !== '')
        .map((s) => ({
            id: newId('stage'),
            name: s.name.trim(),
            description: s.description,
            permissions: s.permissions ?? [],
        }));

    const timeValue = values.scheduleTime;
    const datetimeValue = values.scheduleDatetime;

    return {
        id: existing?.id ?? newId('def'),
        name: values.name?.trim() ?? '',
        description: values.description ?? '',
        enabled: existing?.enabled ?? true,
        schedule: {
            type: values.scheduleType,
            time:
                values.scheduleType !== 'once' && timeValue?.isValid()
                    ? timeValue.format('HH:mm')
                    : undefined,
            datetime:
                values.scheduleType === 'once' && datetimeValue?.isValid()
                    ? datetimeValue.toISOString()
                    : undefined,
            weekdays: values.scheduleType === 'weekly' ? values.weekdays : undefined,
        },
        stages,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        agentPrompt: existing?.agentPrompt,
    };
}
