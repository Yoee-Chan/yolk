import React, {useEffect, useState} from 'react';
import {Card, List, Tag, Typography} from 'antd';

const {Paragraph, Text, Title} = Typography;

interface SkillItem {
    id: string;
    name: string;
    description: string;
    version: string;
    connector?: string;
    tool?: string;
    triggers: string[];
}

export default function Found() {
    const [skills, setSkills] = useState<SkillItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const raw = await window.api.llmSetting(
                    JSON.stringify({SettingType: 'skill', cmd: 'search'})
                );
                const parsed = JSON.parse(raw);
                if (parsed.type === 'command_error') {
                    throw new Error(parsed.error);
                }
                setSkills(parsed.result as SkillItem[]);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load().catch(console.error);
    }, []);

    return (
        <div>
            <Title level={4}>能力扩展</Title>
            <Paragraph type="secondary">
                系统技能通过 YAML 描述定义，Agent 会根据描述与触发词匹配用户意图并调用对应工具。
            </Paragraph>
            <List
                loading={loading}
                dataSource={skills}
                locale={{emptyText: '暂无已注册技能'}}
                renderItem={(item) => (
                    <List.Item>
                        <Card style={{width: '100%'}} size="small">
                            <Text strong>{item.name}</Text>
                            <Tag style={{marginLeft: 8}}>{item.id}</Tag>
                            {item.connector && (
                                <Tag color="blue">连接器: {item.connector}</Tag>
                            )}
                            {item.tool && (
                                <Tag color="green">工具: {item.tool}</Tag>
                            )}
                            <Paragraph style={{marginTop: 8, whiteSpace: 'pre-wrap'}}>
                                {item.description}
                            </Paragraph>
                            {item.triggers?.length > 0 && (
                                <div>
                                    <Text type="secondary">触发示例：</Text>
                                    {item.triggers.map((t) => (
                                        <Tag key={t}>{t}</Tag>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </List.Item>
                )}
            />
        </div>
    );
}
