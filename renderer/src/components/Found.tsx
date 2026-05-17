import React, {useEffect, useState} from 'react';
import {Card, Flex, Spin, Tag, Typography} from 'antd';

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
        <section style={{padding: '24px 32px'}}>
            <Title level={4}>{'\u80fd\u529b\u6269\u5c55'}</Title>
            <Paragraph type="secondary">
                {
                    '\u7cfb\u7edf\u6280\u80fd\u901a\u8fc7 YAML \u63cf\u8ff0\u5b9a\u4e49\uff0cAgent \u4f1a\u6839\u636e\u63cf\u8ff0\u4e0e\u89e6\u53d1\u8bcd\u5339\u914d\u7528\u6237\u610f\u56fe\u5e76\u8c03\u7528\u5bf9\u5e94\u5de5\u5177\u3002'
                }
            </Paragraph>
            {loading ? (
                <Flex justify="center" style={{padding: 48}}>
                    <Spin/>
                </Flex>
            ) : skills.length === 0 ? (
                <Text type="secondary">{'\u6682\u65e0\u5df2\u6ce8\u518c\u6280\u80fd'}</Text>
            ) : (
                <Flex vertical gap={12}>
                    {skills.map((item) => (
                        <Card key={item.id} style={{width: '100%'}} size="small">
                            <Text strong>{item.name}</Text>
                            <Tag style={{marginLeft: 8}}>{item.id}</Tag>
                            {item.connector && (
                                <Tag color="blue">{'\u8fde\u63a5\u5668: '}{item.connector}</Tag>
                            )}
                            {item.tool && (
                                <Tag color="green">{'\u5de5\u5177: '}{item.tool}</Tag>
                            )}
                            <Paragraph style={{marginTop: 8, whiteSpace: 'pre-wrap'}}>
                                {item.description}
                            </Paragraph>
                            {item.triggers?.length > 0 && (
                                <p>
                                    <Text type="secondary">{'\u89e6\u53d1\u793a\u4f8b\uff1a'}</Text>
                                    {item.triggers.map((t) => (
                                        <Tag key={t}>{t}</Tag>
                                    ))}
                                </p>
                            )}
                        </Card>
                    ))}
                </Flex>
            )}
        </section>
    );
}
